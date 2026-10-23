import { EventEmitter } from "node:events";

import WebSocket from "ws";

import { env } from "#/env";

// xAI's realtime voice API (same event shapes as OpenAI's Realtime API).
// Turns are ours: turn_detection is off, so audio is only sent while people
// talk, a turn is committed when they stop, and a reply is asked for when
// it should answer

const URL = "wss://api.x.ai/v1/realtime";

export type RealtimeConfig = {
	model: string;
	voice: string;
	instructions: string;
	languageHint: string;
};

type ServerEvent = {
	type: string;
	delta?: string;
	transcript?: string;
	item_id?: string;
	response_id?: string;
	item?: { id?: string };
	response?: { id?: string; status?: string };
	error?: { message?: string; code?: string; type?: string };
};

// a reply that has sent nothing for this long is treated as finished, so one
// that never completes can't leave it "busy" for the rest of the call
const STALE_RESPONSE_MS = 15_000;

// xAI starts a reply by itself after some commits. That reply waits this long
// to be adopted (the turn turns out to be for the bot) before it's cancelled
const ADOPT_WINDOW_MS = 3_000;

type Reply = {
	id: string;
	ours: boolean;
	done: boolean;
	at: number;
	// audio and transcript of a reply nobody has adopted yet
	held: { pcm: Buffer; itemId: string }[];
	transcript?: string;
	transcriptItem?: string;
};

// errors that mean nothing was wrong, like cancelling a reply that just ended
const HARMLESS = /no active response|not found|already/i;

export class RealtimeVoice extends EventEmitter<{
	// 24kHz mono pcm of the reply, with the conversation item it belongs to
	audio: [pcm: Buffer, itemId: string];
	responseStarted: [];
	responseDone: [];
	// a committed turn of what people said
	committed: [itemId: string];
	heard: [itemId: string, transcript: string];
	said: [transcript: string];
	closed: [];
	failed: [message: string];
}> {
	private socket: WebSocket | undefined;
	private ready = false;
	private pending: object[] = [];
	private responding = false;
	private respondingSince = 0;
	// the bot wants a reply: the first reply from xAI that carries audio is it.
	// xAI also starts replies by itself after commits, some with no audio at
	// all, so which one came first says nothing
	private wanted = false;
	// a reply was wanted while another was still running; ask once it's done
	private askWhenFree = false;
	private readonly replies = new Map<string, Reply>();
	private current: string | null = null;
	private lastCommitAt = 0;
	// replies cancelled by someone talking over them, whose leftover audio is dropped
	private readonly cancelled = new Set<string>();
	// each kind of event xAI sends is logged once, to see what it actually speaks
	private readonly seenTypes = new Set<string>();

	// the url only changes in tests
	constructor(private readonly url = URL) {
		super();
	}

	get connected() {
		return this.socket !== undefined;
	}

	get isResponding() {
		const fresh = Date.now() - this.respondingSince < STALE_RESPONSE_MS;
		// a wanted reply that never came stops being waited for too
		if (!fresh) this.wanted = false;
		return this.responding && fresh;
	}

	connect(config: RealtimeConfig) {
		if (this.socket) return;
		const socket = new WebSocket(
			`${this.url}?model=${encodeURIComponent(config.model)}`,
			{ headers: { Authorization: `Bearer ${env.XAI_API_KEY}` } },
		);
		this.socket = socket;
		this.ready = false;

		socket.on("open", () => {
			if (socket !== this.socket) return;
			this.ready = true;
			console.log(
				`[voice] connected to xAI (${config.model}, ${config.voice})`,
			);
			this.sendNow(sessionUpdate(config));
			for (const event of this.pending.splice(0)) this.sendNow(event);
		});
		socket.on("message", (data) => {
			if (socket !== this.socket) return;
			try {
				this.onEvent(JSON.parse(data.toString()) as ServerEvent);
			} catch (error) {
				console.error("[voice] bad event from xAI", error);
			}
		});
		socket.on("error", (error) => {
			console.error("[voice] xAI connection error", error.message);
			if (!this.ready) this.emit("failed", error.message);
		});
		socket.on("close", (code, reason) => {
			if (socket !== this.socket) return;
			if (code !== 1000) {
				console.warn(`[voice] xAI closed (${code}) ${reason.toString()}`);
			}
			this.reset();
			this.emit("closed");
		});
	}

	close() {
		const socket = this.socket;
		this.reset();
		socket?.close(1000);
	}

	update(config: RealtimeConfig) {
		if (this.socket) this.send(sessionUpdate(config));
	}

	appendAudio(pcm: Buffer) {
		this.send({
			type: "input_audio_buffer.append",
			audio: pcm.toString("base64"),
		});
	}

	commit() {
		this.lastCommitAt = Date.now();
		this.send({ type: "input_audio_buffer.commit" });
	}

	clearInput() {
		this.send({ type: "input_audio_buffer.clear" });
	}

	respond() {
		this.responding = true;
		this.respondingSince = Date.now();
		this.wanted = true;
		// xAI may already be saying something for this turn
		const spoken = [...this.replies.values()]
			.reverse()
			.find(
				(reply) =>
					!reply.ours && reply.held.length > 0 && reply.at >= this.lastCommitAt,
			);
		if (spoken) {
			this.adopt(spoken);
			return;
		}
		// asking while another reply runs would be refused, so wait for it
		const running = [...this.replies.values()].some((reply) => !reply.done);
		if (running) this.askWhenFree = true;
		else this.send({ type: "response.create" });
	}

	private adopt(reply: Reply) {
		reply.ours = true;
		this.wanted = false;
		this.askWhenFree = false;
		this.current = reply.id;
		this.emit("responseStarted");
		for (const { pcm, itemId } of reply.held.splice(0)) {
			if (!this.cancelled.has(itemId)) this.emit("audio", pcm, itemId);
		}
		if (reply.transcript && !this.cancelled.has(reply.transcriptItem ?? "")) {
			this.emit("said", reply.transcript);
		}
		if (reply.done) this.finish(reply);
	}

	private finish(reply: Reply) {
		if (this.current === reply.id) this.current = null;
		this.responding = false;
		this.emit("responseDone");
	}

	private dropIfUnwanted(reply: Reply) {
		if (reply.ours || reply.held.length === 0) return;
		if (!reply.done) this.sendNow({ type: "response.cancel" });
		const items = new Set(
			[...reply.held.map((h) => h.itemId), reply.transcriptItem].filter(
				(id): id is string => Boolean(id),
			),
		);
		for (const id of items) {
			this.sendNow({ type: "conversation.item.delete", item_id: id });
		}
		reply.held.length = 0;
		console.log("[voice] dropped a reply xAI started on its own");
	}

	// which reply an event belongs to; xAI may leave the id off
	private replyFor(event: ServerEvent) {
		const id = event.response_id ?? event.response?.id;
		if (id) return this.replies.get(id);
		if (this.current) return this.replies.get(this.current);
		return [...this.replies.values()].at(-1);
	}

	// someone talked over it: stop generating, and cut the item down to what
	// they actually heard so it doesn't think it said the rest
	interrupt(itemId: string | null, heardMs: number) {
		if (this.responding) this.send({ type: "response.cancel" });
		this.responding = false;
		this.wanted = false;
		this.askWhenFree = false;
		if (itemId) {
			this.cancelled.add(itemId);
			this.send({
				type: "conversation.item.truncate",
				item_id: itemId,
				content_index: 0,
				audio_end_ms: Math.max(0, Math.round(heardMs)),
			});
		}
	}

	private reset() {
		this.socket?.removeAllListeners("message");
		this.socket = undefined;
		this.ready = false;
		this.pending = [];
		this.responding = false;
		this.wanted = false;
		this.askWhenFree = false;
		this.replies.clear();
		this.current = null;
		this.cancelled.clear();
	}

	private send(event: object) {
		if (!this.socket) return;
		if (this.ready) this.sendNow(event);
		else this.pending.push(event);
	}

	private sendNow(event: object) {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(event));
		}
	}

	private onEvent(event: ServerEvent) {
		if (!this.seenTypes.has(event.type)) {
			this.seenTypes.add(event.type);
			const detail =
				event.type === "session.updated" || event.type === "session.created"
					? ` ${JSON.stringify(event).slice(0, 600)}`
					: "";
			console.log(`[voice] xAI sent ${event.type}${detail}`);
		}
		switch (event.type) {
			case "response.created": {
				const id = event.response?.id ?? `reply-${Date.now()}`;
				const reply: Reply = {
					id,
					ours: false,
					done: false,
					at: Date.now(),
					held: [],
				};
				this.replies.set(id, reply);
				setTimeout(() => this.replies.delete(id), 30_000);
				// one that never turns out to be wanted is cancelled, and taken out
				// of the conversation so the model doesn't think it said it
				setTimeout(() => this.dropIfUnwanted(reply), ADOPT_WINDOW_MS);
				break;
			}
			case "response.output_audio.delta":
			case "response.audio.delta": {
				const itemId = event.item_id ?? "";
				if (!event.delta || this.cancelled.has(itemId)) break;
				const pcm = Buffer.from(event.delta, "base64");
				const reply = this.replyFor(event);
				if (reply && !reply.ours) {
					reply.held.push({ pcm, itemId });
					if (this.wanted) this.adopt(reply);
					break;
				}
				this.respondingSince = Date.now();
				this.emit("audio", pcm, itemId);
				break;
			}
			case "response.output_audio_transcript.done":
			case "response.audio_transcript.done": {
				const reply = this.replyFor(event);
				if (reply && !reply.ours) {
					reply.transcript = event.transcript;
					reply.transcriptItem = event.item_id;
					break;
				}
				// a reply cut off partway wasn't heard in full, so it isn't remembered
				if (event.transcript && !this.cancelled.has(event.item_id ?? "")) {
					this.emit("said", event.transcript);
				}
				break;
			}
			case "response.done": {
				const reply = this.replyFor(event);
				if (reply) reply.done = true;
				if (reply?.ours) {
					this.finish(reply);
					break;
				}
				// a reply was wanted but this one had nothing to say: ask for one
				const running = [...this.replies.values()].some((r) => !r.done);
				if (this.wanted && this.askWhenFree && !running) {
					this.askWhenFree = false;
					this.sendNow({ type: "response.create" });
				}
				break;
			}
			case "input_audio_buffer.committed":
				this.emit("committed", event.item_id ?? event.item?.id ?? "");
				break;
			case "conversation.item.input_audio_transcription.completed":
				this.emit("heard", event.item_id ?? "", event.transcript ?? "");
				break;
			case "error": {
				const message = event.error?.message ?? "unknown error";
				// asked while xAI's own reply was still running: ask again after it
				if (this.wanted && /active response/i.test(message)) {
					this.askWhenFree = true;
					console.log(`[voice] xAI note: ${message} (asking again when free)`);
					break;
				}
				if (HARMLESS.test(message)) {
					console.log(`[voice] xAI note: ${message}`);
					break;
				}
				console.error("[voice] xAI error", event.error);
				this.emit("failed", message);
				break;
			}
		}
	}
}

const sessionUpdate = (config: RealtimeConfig) => ({
	type: "session.update",
	session: {
		voice: config.voice,
		instructions: config.instructions,
		turn_detection: null,
		audio: {
			input: {
				format: { type: "audio/pcm", rate: 24_000 },
				transcription: {
					model: "grok-transcribe",
					...(config.languageHint && {
						language_hint: config.languageHint,
					}),
				},
			},
			output: { format: { type: "audio/pcm", rate: 24_000 } },
		},
	},
});
