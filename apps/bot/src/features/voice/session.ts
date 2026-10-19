import { getSettings, type Settings } from "@klyndre/config";
import type { TextBasedChannel, VoiceBasedChannel } from "discord.js";
import {
	type GuildQueue,
	getVoiceConnection,
	joinVoiceChannel,
	useMainPlayer,
} from "discord-player";
import { OpusEncoder } from "mediaplex";

import { outputs } from "#/features/voice/mixer";
import { VoiceOutput } from "#/features/voice/output";
import {
	addStereoAsMono,
	downsampleHalf,
	FRAME_MS,
	FRAME_SAMPLES,
	rms,
} from "#/features/voice/pcm";
import {
	botNameIn,
	humansIn,
	mentionsName,
	voiceInstructions,
} from "#/features/voice/prompt";
import { RealtimeVoice } from "#/features/voice/realtime";
import { type VoiceConnection, VoiceReceiver } from "#/features/voice/receiver";
import { VoiceStats } from "#/features/voice/stats";

// louder than this (out of 32768) counts as someone talking, for clients that
// keep sending audio through background noise
const VOICE_RMS = 400;
// how long someone has to talk over it before it stops to listen. Alone with
// one person that's anyone; in a group it's only who it's answering, and
// longer, since people talk over each other all the time
const BARGE_IN_MS = 240;
const GROUP_BARGE_IN_MS = 600;
// a speaker counts as part of a turn with at least this share of its talking
const MAIN_SPEAKER_SHARE = 0.4;
// at most this much of one person's audio waits to be mixed, so a stalled
// clock can't build up a delay
const MAX_BACKLOG_FRAMES = 6;
// audio goes to xAI in batches this size
const SEND_EVERY_FRAMES = 5;
const READY_TIMEOUT_MS = 15_000;
const TRANSCRIPT_WAIT_MS = 8_000;
const FAILURE_NOTICE_EVERY_MS = 5 * 60_000;

type Turn = {
	itemId: string | null;
	speakers: string;
	speakerIds: string[];
	needsName: boolean;
	at: number;
};

export const sessions = new Map<string, VoiceSession>();

export class VoiceSession {
	private readonly realtime = new RealtimeVoice();
	private readonly reporter = setInterval(
		() => this.stats.report(this.channel.name),
		5_000,
	);
	private readonly receiver: VoiceReceiver;
	private readonly output: VoiceOutput;
	private readonly decoders = new Map<string, OpusEncoder>();
	private readonly backlog = new Map<string, Buffer[]>();
	private readonly clock: NodeJS.Timeout;
	private readonly startedAt = Date.now();
	private ticks = 0;

	// the turn being spoken right now
	private inTurn = false;
	private voicedMs = 0;
	private lastVoiceAt = 0;
	// ms of speech per person this turn
	private readonly voicedBy = new Map<string, number>();
	private bargedThisTurn = false;
	// who it's answering: only they can cut it off or follow up without its name
	private talkingTo = new Set<string>();
	// xAI's transcripts repeat earlier turns, so only what's new is used
	private lastTranscript = "";
	private readonly heardItems = new Set<string>();
	private pending: Buffer[] = [];
	// committed turns waiting for their transcript
	private turns: Turn[] = [];

	private settings: Settings<"voice">;
	private instructions = "";
	private readonly memory: string[] = [];
	private lastSaidAt = 0;
	private idleTimer: NodeJS.Timeout | null = null;
	private aloneTimer: NodeJS.Timeout | null = null;
	private lastFailureNotice = 0;
	private ended = false;

	private constructor(
		public channel: VoiceBasedChannel,
		private readonly textChannel: TextBasedChannel | null,
		private readonly connection: VoiceConnection,
		settings: Settings<"voice">,
		receiver: VoiceReceiver,
		private readonly stats: VoiceStats,
	) {
		this.settings = settings;
		const guildId = channel.guild.id;
		this.receiver = receiver;
		this.receiver.on("opus", (userId, packet) => this.onOpus(userId, packet));
		this.output = new VoiceOutput(
			guildId,
			() => this.liveConnection(),
			() => this.settings.musicDuckVolume,
		);
		outputs.set(guildId, this.output);
		this.clock = setInterval(() => this.tick(), FRAME_MS);
		this.wireRealtime();
	}

	static async start(
		channel: VoiceBasedChannel,
		textChannel: TextBasedChannel | null,
	) {
		const guildId = channel.guild.id;
		const group = channel.client.user.id;
		let connection = getVoiceConnection(guildId, group);
		if (connection?.state.status === "destroyed") connection = undefined;

		if (!connection) {
			connection = joinVoiceChannel({
				guildId,
				channelId: channel.id,
				adapterCreator: channel.guild.voiceAdapterCreator,
				selfDeaf: false,
				group,
				daveEncryption: true,
			});
		} else if (connection.joinConfig.selfDeaf) {
			// music joins deafened, and a deafened bot hears nothing
			connection.rejoin({ ...connection.joinConfig, selfDeaf: false });
		}
		// listening starts before the connection is ready, since discord says
		// whose audio is whose right as it connects
		const stats = new VoiceStats();
		const humans = () => humansIn(channel);
		const receiver = new VoiceReceiver(
			connection,
			(userId) => humans().has(userId),
			() => [...humans().keys()],
			stats,
		);
		let settings: Settings<"voice">;
		try {
			await ready(connection);
			settings = await getSettings(guildId, "voice");
		} catch (error) {
			receiver.destroy();
			throw error;
		}

		const session = new VoiceSession(
			channel,
			textChannel,
			connection,
			settings,
			receiver,
			stats,
		);
		sessions.set(guildId, session);
		const queue = useMainPlayer().nodes.get(guildId);
		if (queue) keepConnectionThroughMusic(queue);
		session.output.primeWithSilence();
		await session.refreshInstructions();
		session.checkAlone();
		console.log(`[voice] joined ${channel.name} in ${channel.guild.name}`);
		return session;
	}

	// --- hearing ---

	private onOpus(userId: string, packet: Buffer) {
		let decoder = this.decoders.get(userId);
		if (!decoder) {
			decoder = new OpusEncoder(48_000, 2);
			this.decoders.set(userId, decoder);
		}
		let pcm: Buffer;
		try {
			pcm = decoder.decode(packet);
		} catch (error) {
			this.stats.error("opus decode error", error);
			return;
		}
		this.stats.count("decoded");
		const queue = this.backlog.get(userId) ?? [];
		queue.push(pcm);
		if (queue.length > MAX_BACKLOG_FRAMES) queue.shift();
		this.backlog.set(userId, queue);
	}

	// every 20ms: mix whoever is talking into one stream for xAI
	private tick() {
		const now = Date.now();
		const due = Math.floor((now - this.startedAt) / FRAME_MS) - this.ticks;
		// after a stall, catch up a little and drop the rest
		this.ticks += Math.max(0, due - 5);
		for (let i = 0; i < Math.min(due, 5); i++) {
			this.ticks++;
			this.mixFrame(now);
		}
		if (this.pending.length >= SEND_EVERY_FRAMES) this.flush();
		if (this.inTurn && now - this.lastVoiceAt >= this.settings.turnSilenceMs) {
			this.endTurn();
		}
		if (this.connection.listenerCount("error") === 0) {
			// discord-player strips listeners off the connection when a queue
			// ends, and an unheard error would crash the bot
			this.connection.on("error", (error) =>
				console.error("[voice] connection error", error.message),
			);
		}
	}

	private mixFrame(now: number) {
		const mix = new Int32Array(FRAME_SAMPLES);
		const voicedUsers: string[] = [];
		for (const [userId, queue] of this.backlog) {
			const frame = queue.shift();
			if (!frame) continue;
			addStereoAsMono(frame, mix);
			const level = rms(frame);
			this.stats.level(level);
			if (level > VOICE_RMS) voicedUsers.push(userId);
		}

		if (voicedUsers.length > 0) {
			this.lastVoiceAt = now;
			if (!this.inTurn) this.startTurn();
			this.voicedMs += FRAME_MS;
			for (const userId of voicedUsers) {
				this.voicedBy.set(userId, (this.voicedBy.get(userId) ?? 0) + FRAME_MS);
			}
			if (!this.bargedThisTurn && this.output.speaking && this.talkedOver()) {
				this.bargedThisTurn = true;
				this.stats.count("talked over");
				this.bargeIn();
			}
		}
		if (this.inTurn) this.pending.push(downsampleHalf(mix));
	}

	private talkedOver() {
		if (humansIn(this.channel).size <= 1) return this.voicedMs >= BARGE_IN_MS;
		return [...this.talkingTo].some(
			(id) => (this.voicedBy.get(id) ?? 0) >= GROUP_BARGE_IN_MS,
		);
	}

	// who did most of the talking this turn, not everyone who made a sound
	private mainSpeakers() {
		const most = Math.max(0, ...this.voicedBy.values());
		return [...this.voicedBy]
			.filter(([, ms]) => ms >= most * MAIN_SPEAKER_SHARE)
			.sort((a, b) => b[1] - a[1])
			.map(([id]) => id);
	}

	private flush() {
		if (this.pending.length === 0) return;
		this.realtime.appendAudio(Buffer.concat(this.pending));
		this.pending = [];
	}

	private startTurn() {
		this.stats.count("turns");
		this.inTurn = true;
		this.voicedMs = 0;
		this.voicedBy.clear();
		this.bargedThisTurn = false;
		this.pending = [];
		this.stopIdleTimer();
		if (!this.realtime.connected) this.connectRealtime();
	}

	private endTurn() {
		this.inTurn = false;
		this.flush();
		if (this.voicedMs < this.settings.minSpeechMs) {
			this.stats.count("too short");
			this.realtime.clearInput();
			this.startIdleTimer();
			return;
		}

		const humans = humansIn(this.channel).size;
		const speakerIds = this.mainSpeakers();
		// answering it back without saying its name only works for whoever it
		// was just talking to
		// a laugh or "haha" while it's still talking is a reaction, not a
		// reply to answer. Only actually talking over it (see talkedOver) is
		const reacting = this.output.speaking && !this.bargedThisTurn;
		const followingUp =
			!reacting &&
			Date.now() - this.lastSaidAt < this.settings.followUpWindowMs &&
			speakerIds.some((id) => this.talkingTo.has(id));
		// while it's still working on or saying a reply, a new reply would cancel
		// it. In a busy call that happens every turn and nothing gets said, so
		// then only saying its name or talking over it starts a new one
		const busy =
			(this.realtime.isResponding || this.output.speaking) &&
			!this.bargedThisTurn;
		const needsName =
			busy || (this.settings.answerOnlyWhenNamed && humans > 1 && !followingUp);
		this.turns.push({
			itemId: null,
			speakers: this.speakerNames(speakerIds),
			speakerIds,
			needsName,
			at: Date.now(),
		});

		this.stats.count(needsName ? "committed, waiting for name" : "committed");
		this.realtime.commit();
		if (!needsName) this.reply(speakerIds);
		else this.startIdleTimer();
	}

	private speakerNames(ids: string[]) {
		const names = ids.map(
			(id) =>
				this.channel.guild.members.cache.get(id)?.displayName ?? "someone",
		);
		return names.length > 0 ? names.join(" & ") : "someone";
	}

	// --- talking ---

	private reply(to: string[]) {
		this.stats.count("replies asked");
		this.talkingTo = new Set(to);
		if (this.realtime.isResponding || this.output.speaking) this.bargeIn();
		this.output.setReplying(true);
		this.realtime.respond();
	}

	private bargeIn() {
		const { itemId, heardMs } = this.output.clear();
		this.realtime.interrupt(itemId, heardMs);
		this.output.setReplying(false);
	}

	private wireRealtime() {
		this.realtime.on("audio", (pcm, itemId) => {
			this.stats.count("reply audio chunks");
			this.output.enqueue(pcm, itemId);
		});
		// lastSaidAt is only set by "said", so a reply cut off before anyone
		// heard it doesn't open the follow-up window
		this.realtime.on("responseDone", () => {
			this.output.setReplying(false);
			this.startIdleTimer();
		});
		this.realtime.on("said", (text) => {
			this.lastSaidAt = Date.now();
			this.remember(`${botNameIn(this.channel)}: ${text}`);
			console.log(`[voice] ${botNameIn(this.channel)}: ${text}`);
		});
		this.realtime.on("committed", (itemId) => {
			const turn = this.turns.find((t) => t.itemId === null);
			if (turn) turn.itemId = itemId;
		});
		this.realtime.on("heard", (itemId, transcript) =>
			this.onHeard(itemId, transcript),
		);
		this.realtime.on("closed", () => {
			this.output.setReplying(false);
			this.turns = [];
		});
		this.realtime.on("failed", (message) => this.onFailure(message));
	}

	private onHeard(itemId: string, transcript: string) {
		// the same item can be transcribed more than once
		if (itemId) {
			if (this.heardItems.has(itemId)) return;
			this.heardItems.add(itemId);
			if (this.heardItems.size > 200) this.heardItems.clear();
		}
		const text = newPart(this.lastTranscript, transcript);
		this.lastTranscript = transcript.trim();
		const cutoff = Date.now() - TRANSCRIPT_WAIT_MS;
		this.turns = this.turns.filter((t) => t.at >= cutoff);
		const index = this.turns.findIndex(
			(t) => t.itemId === itemId || (itemId === "" && t.itemId !== null),
		);
		const turn = index >= 0 ? this.turns.splice(index, 1)[0] : undefined;
		const speakers = turn?.speakers ?? "someone";
		if (!text) return;
		this.remember(`${speakers}: ${text}`);
		console.log(`[voice] ${speakers}: ${text}`);
		if (turn?.needsName && mentionsName(text, this.names())) {
			this.reply(turn.speakerIds);
		}
	}

	private names() {
		return [
			botNameIn(this.channel),
			this.channel.client.user.username,
			...this.settings.names.split(","),
		].filter((name) => name.trim());
	}

	private remember(line: string) {
		this.memory.push(line);
		const keep = this.settings.memoryTurns;
		if (this.memory.length > keep) {
			this.memory.splice(0, this.memory.length - keep);
		}
	}

	private onFailure(message: string) {
		const now = Date.now();
		if (now - this.lastFailureNotice < FAILURE_NOTICE_EVERY_MS) return;
		this.lastFailureNotice = now;
		if (this.textChannel && "send" in this.textChannel) {
			void this.textChannel
				.send(`⚠️ Voice AI problem: ${message}`)
				.catch(() => {});
		}
	}

	// --- the xAI connection, opened while people talk ---

	private connectRealtime() {
		this.realtime.connect({
			model: this.settings.model,
			voice: this.settings.voice,
			instructions: this.instructions,
			languageHint: this.settings.languageHint.trim(),
		});
	}

	// called when people join or leave, so it knows who's in the call
	async refreshInstructions() {
		this.settings = await getSettings(this.channel.guild.id, "voice");
		this.instructions = await voiceInstructions(this.channel, this.memory);
		if (this.realtime.connected) {
			this.realtime.update({
				model: this.settings.model,
				voice: this.settings.voice,
				instructions: this.instructions,
				languageHint: this.settings.languageHint.trim(),
			});
		}
	}

	private startIdleTimer() {
		this.stopIdleTimer();
		const ms = this.settings.idleDisconnectMs;
		if (ms <= 0) return;
		this.idleTimer = setTimeout(() => {
			if (this.inTurn || this.output.speaking || this.realtime.isResponding) {
				this.startIdleTimer();
				return;
			}
			this.realtime.close();
			// what was said comes back in the prompt when it reconnects
			void this.refreshInstructions().catch(() => {});
		}, ms);
	}

	private stopIdleTimer() {
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = null;
	}

	// --- the call itself ---

	checkAlone() {
		const alone = humansIn(this.channel).size === 0;
		if (!alone) {
			if (this.aloneTimer) clearTimeout(this.aloneTimer);
			this.aloneTimer = null;
			return;
		}
		if (this.aloneTimer) return;
		this.aloneTimer = setTimeout(
			() => void this.end("nobody left in the call"),
			this.settings.leaveWhenAloneMs,
		);
	}

	private liveConnection() {
		return this.connection.state.status === "destroyed"
			? undefined
			: this.connection;
	}

	async end(reason: string) {
		if (this.ended) return;
		this.ended = true;
		sessions.delete(this.channel.guild.id);
		outputs.delete(this.channel.guild.id);
		clearInterval(this.clock);
		clearInterval(this.reporter);
		this.stats.report(this.channel.name);
		this.stopIdleTimer();
		if (this.aloneTimer) clearTimeout(this.aloneTimer);
		this.receiver.destroy();
		this.output.destroy();
		this.realtime.close();
		this.decoders.clear();
		this.backlog.clear();
		console.log(`[voice] left ${this.channel.name}: ${reason}`);

		const connection = this.liveConnection();
		if (!connection) return;
		const queue = useMainPlayer().nodes.get(this.channel.guild.id);
		if (queue?.dispatcher) {
			// the music stays, and gets the connection back
			connection.subscribe(queue.dispatcher.audioPlayer);
		} else {
			connection.destroy();
		}
	}
}

// discord-player hangs up when a queue ends (stop, queue over, leave timers).
// During a call that would cut the AI off too, so its dispatcher only stops
// the music then and leaves the connection alone
const kept = new WeakSet<object>();
export function keepConnectionThroughMusic(queue: GuildQueue) {
	const dispatcher = queue.dispatcher;
	if (!dispatcher || kept.has(dispatcher)) return;
	kept.add(dispatcher);
	const hangUp = dispatcher.disconnect.bind(dispatcher);
	dispatcher.disconnect = () => {
		if (sessions.has(queue.guild.id)) dispatcher.audioPlayer.stop(true);
		else hangUp();
	};
}

// xAI's transcript of a turn sometimes starts with the previous turns again
// ("a." then "a. b." then "a. b. c."), so only the part after what was already
// heard is new. Matched loosely, since the repeat can be worded a little
// differently each time
export function newPart(previous: string, current: string) {
	const now = current.trim();
	const before = previous.trim();
	if (!before) return now;
	let shared = 0;
	const limit = Math.min(before.length, now.length);
	while (shared < limit && before[shared] === now[shared]) shared++;
	if (shared < before.length * 0.6) return now;
	// when they part ways inside a word ("begynne"/"begynner"), back up to its
	// start; at a word's end ("hacket."/"hacket,") the new part starts there
	const splitsWord = /[\p{L}\p{N}]/u.test(now[shared] ?? "") && shared > 0;
	const from = splitsWord ? now.lastIndexOf(" ", shared - 1) + 1 : shared;
	return now
		.slice(from)
		.replace(/^[\s.,!?]+/, "")
		.trim();
}

function ready(connection: VoiceConnection) {
	if (connection.state.status === "ready") return Promise.resolve();
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			connection.off("stateChange", onChange);
			reject(new Error("Couldn't connect to the voice channel in time"));
		}, READY_TIMEOUT_MS);
		const onChange = () => {
			const { status } = connection.state;
			if (status === "ready" || status === "destroyed") {
				clearTimeout(timeout);
				connection.off("stateChange", onChange);
				if (status === "ready") resolve();
				else reject(new Error("The voice connection closed"));
			}
		};
		connection.on("stateChange", onChange);
	});
}
