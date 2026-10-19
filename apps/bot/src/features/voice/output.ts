import { Readable } from "node:stream";

import {
	type AudioPlayer,
	createAudioPlayer,
	createAudioResource,
	StreamType,
	useMainPlayer,
} from "discord-player";

import {
	clamp16,
	DISCORD_RATE,
	FRAME_MS,
	FRAME_SAMPLES,
	STEREO_FRAME_BYTES,
	Upsampler,
} from "#/features/voice/pcm";
import type { VoiceConnection } from "#/features/voice/receiver";

// The AI's voice reaches the call one of two ways:
// - music playing: mixed into the song's pcm on its way out (see mixer.ts),
//   with the song turned down while it talks
// - otherwise: its own audio player, borrowing the connection until it's done

// how far ahead of real time the solo stream may run. Small, so cutting it off
// when someone talks over it stops it almost right away
const SOLO_LEAD_MS = 100;
// silence it keeps sending through short gaps in a reply, so the player
// doesn't give up on the stream mid-sentence
const GAP_GRACE_MS = 400;
// fades the music down in 150ms and back up in 400ms
const DUCK_DOWN_PER_SAMPLE = 1 / (DISCORD_RATE * 0.15);
const DUCK_UP_PER_SAMPLE = 1 / (DISCORD_RATE * 0.4);
const SAMPLES_PER_MS = DISCORD_RATE / 1000;

type Chunk = { samples: Int16Array; itemId: string };

export class VoiceOutput {
	// 48kHz mono, waiting to be played
	private readonly chunks: Chunk[] = [];
	private offset = 0;
	private readonly upsampler = new Upsampler();
	private currentItem: string | null = null;
	private playedSamples = 0;
	private lastAudioAt = 0;
	private replying = false;
	private gain = 1;
	private solo: SoloStream | null = null;
	private readonly player: AudioPlayer = createAudioPlayer();
	private readonly watchdog: NodeJS.Timeout;

	constructor(
		private readonly guildId: string,
		private readonly connection: () => VoiceConnection | undefined,
		private readonly duckVolume: () => number,
	) {
		this.player.on("error", (error) => {
			console.error("[voice] playback error", error.message);
		});
		this.player.on("stateChange", (_old, state) => {
			if (state.status === "idle") this.endSolo();
		});
		this.watchdog = setInterval(() => this.route(), 50);
	}

	get speaking() {
		return (
			this.queued > 0 ||
			this.solo !== null ||
			Date.now() - this.lastAudioAt < GAP_GRACE_MS
		);
	}

	private get queued() {
		let total = -this.offset;
		for (const chunk of this.chunks) total += chunk.samples.length;
		return Math.max(0, total);
	}

	// a reply is being generated, so gaps in its audio are waits, not the end
	setReplying(replying: boolean) {
		this.replying = replying;
	}

	enqueue(pcm24k: Buffer, itemId: string) {
		if (itemId !== this.currentItem && this.chunks.length === 0) {
			this.upsampler.reset();
		}
		this.chunks.push({ samples: this.upsampler.push(pcm24k), itemId });
		this.lastAudioAt = Date.now();
		this.route();
	}

	// a moment of silence on joining: discord can hold back other people's
	// audio from a client that hasn't sent any of its own yet
	primeWithSilence() {
		this.enqueue(Buffer.alloc(24_000 * 0.2 * 2), "");
	}

	// drops whatever hasn't been heard yet, and says how much of the item was
	clear(): { itemId: string | null; heardMs: number } {
		const itemId = this.currentItem ?? this.chunks[0]?.itemId ?? null;
		const heardMs = this.playedSamples / SAMPLES_PER_MS;
		this.chunks.length = 0;
		this.offset = 0;
		this.upsampler.reset();
		this.currentItem = null;
		this.playedSamples = 0;
		this.lastAudioAt = 0;
		this.solo?.finish();
		return { itemId, heardMs };
	}

	destroy() {
		clearInterval(this.watchdog);
		this.clear();
		this.player.stop(true);
		this.player.removeAllListeners();
	}

	// up to `count` samples of the reply, padded with silence
	private take(count: number) {
		const out = new Int16Array(count);
		let filled = 0;
		while (filled < count) {
			const chunk = this.chunks[0];
			if (!chunk) break;
			if (chunk.itemId !== this.currentItem) {
				this.currentItem = chunk.itemId;
				this.playedSamples = 0;
			}
			const n = Math.min(count - filled, chunk.samples.length - this.offset);
			out.set(chunk.samples.subarray(this.offset, this.offset + n), filled);
			filled += n;
			this.offset += n;
			this.playedSamples += n;
			if (this.offset >= chunk.samples.length) {
				this.chunks.shift();
				this.offset = 0;
			}
		}
		return { samples: out, real: filled };
	}

	// --- music: called by the mixer for every chunk of the song ---

	mixMusic(music: Buffer): Buffer {
		const frames = music.length >> 2;
		const { samples: voice } = this.take(frames);
		const target = this.speaking ? this.duckVolume() : 1;
		const out = Buffer.allocUnsafe(frames * 4);
		for (let i = 0; i < frames; i++) {
			if (this.gain > target) {
				this.gain = Math.max(target, this.gain - DUCK_DOWN_PER_SAMPLE);
			} else if (this.gain < target) {
				this.gain = Math.min(target, this.gain + DUCK_UP_PER_SAMPLE);
			}
			const add = voice[i] ?? 0;
			out.writeInt16LE(
				clamp16(Math.round(music.readInt16LE(i * 4) * this.gain) + add),
				i * 4,
			);
			out.writeInt16LE(
				clamp16(Math.round(music.readInt16LE(i * 4 + 2) * this.gain) + add),
				i * 4 + 2,
			);
		}
		return out;
	}

	// --- solo: its own player while no music is playing ---

	private musicPlaying() {
		const queue = useMainPlayer().nodes.get(this.guildId);
		return Boolean(queue?.node.isPlaying());
	}

	private route() {
		if (this.queued === 0 || this.solo || this.musicPlaying()) return;
		const connection = this.connection();
		if (!connection) return;

		const stream = new SoloStream(this);
		this.solo = stream;
		this.player.play(
			createAudioResource(stream, { inputType: StreamType.Raw }),
		);
		connection.subscribe(this.player);
	}

	// pulled by the solo stream, one 20ms stereo frame at a time
	nextSoloFrame(): Buffer | null {
		if (this.musicPlaying()) return null;
		const waiting =
			this.replying || Date.now() - this.lastAudioAt < GAP_GRACE_MS;
		if (this.queued === 0 && !waiting) return null;

		const { samples } = this.take(FRAME_SAMPLES);
		const frame = Buffer.allocUnsafe(STEREO_FRAME_BYTES);
		for (let i = 0; i < FRAME_SAMPLES; i++) {
			const sample = samples[i] ?? 0;
			frame.writeInt16LE(sample, i * 4);
			frame.writeInt16LE(sample, i * 4 + 2);
		}
		return frame;
	}

	private endSolo() {
		if (!this.solo) return;
		this.solo.finish();
		this.solo = null;
		// give the connection back to the music, paused or not
		const dispatcher = useMainPlayer().nodes.get(this.guildId)?.dispatcher;
		const connection = this.connection();
		if (dispatcher && connection) connection.subscribe(dispatcher.audioPlayer);
		// anything that arrived as it ended gets a new stream
		this.route();
	}
}

// paced to real time so it never runs far ahead of what's been heard
export class SoloStream extends Readable {
	private readonly started = Date.now();
	private sentMs = 0;
	private timer: NodeJS.Timeout | null = null;
	private done = false;

	constructor(private readonly output: VoiceOutput) {
		super({ highWaterMark: STEREO_FRAME_BYTES });
	}

	finish() {
		if (this.done) return;
		this.done = true;
		if (this.timer) clearTimeout(this.timer);
		this.push(null);
	}

	override _read() {
		this.pump();
	}

	private pump() {
		this.timer = null;
		if (this.done) return;
		while (this.sentMs < Date.now() - this.started + SOLO_LEAD_MS) {
			const frame = this.output.nextSoloFrame();
			if (!frame) {
				this.finish();
				return;
			}
			this.sentMs += FRAME_MS;
			if (!this.push(frame)) return;
		}
		this.timer = setTimeout(() => this.pump(), FRAME_MS);
	}

	override _destroy(error: Error | null, callback: (error?: Error) => void) {
		this.done = true;
		if (this.timer) clearTimeout(this.timer);
		callback(error ?? undefined);
	}
}
