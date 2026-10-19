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
	// replies asked for and not yet started; anything else xAI starts on its
	// own after a commit is cancelled
	private requested = 0;
	private readonly unrequested = new Set<string>();
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
		return (
			this.responding && Date.now() - this.respondingSince < STALE_RESPONSE_MS
		);
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
		this.send({ type: "input_audio_buffer.commit" });
	}

	clearInput() {
		this.send({ type: "input_audio_buffer.clear" });
	}

	respond() {
		this.responding = true;
		this.respondingSince = Date.now();
		this.requested++;
		this.send({ type: "response.create" });
	}

	// someone talked over it: stop generating, and cut the item down to what
	// they actually heard so it doesn't think it said the rest
	interrupt(itemId: string | null, heardMs: number) {
		if (this.responding) this.send({ type: "response.cancel" });
		this.responding = false;
		// asked for but not started yet: cancelled as soon as it starts
		this.requested = 0;
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
		this.requested = 0;
		this.unrequested.clear();
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
				const id = event.response?.id ?? "";
				if (this.requested === 0) {
					// xAI answered a commit nobody asked it to answer
					if (id) this.unrequested.add(id);
					this.sendNow({ type: "response.cancel" });
					console.log("[voice] cancelled a reply xAI started on its own");
					break;
				}
				this.requested--;
				this.responding = true;
				this.respondingSince = Date.now();
				this.emit("responseStarted");
				break;
			}
			case "response.output_audio.delta":
			case "response.audio.delta": {
				const itemId = event.item_id ?? "";
				if (!event.delta || this.cancelled.has(itemId)) break;
				if (this.unrequested.has(event.response_id ?? "")) break;
				this.respondingSince = Date.now();
				this.emit("audio", Buffer.from(event.delta, "base64"), itemId);
				break;
			}
			case "response.output_audio_transcript.done":
			case "response.audio_transcript.done":
				// a reply cut off partway wasn't heard in full, so it isn't remembered
				if (event.transcript && !this.cancelled.has(event.item_id ?? "")) {
					this.emit("said", event.transcript);
				}
				break;
			case "response.done": {
				const id = event.response?.id ?? "";
				if (this.unrequested.delete(id)) break;
				this.responding = false;
				this.emit("responseDone");
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
