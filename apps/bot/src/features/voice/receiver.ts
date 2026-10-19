import crypto from "node:crypto";
import { EventEmitter } from "node:events";

import type { joinVoiceChannel } from "discord-player";

import type { VoiceStats } from "#/features/voice/stats";

// discord-voip (what discord-player plays through) can send audio but has no
// receiver, so this is @discordjs/voice's VoiceReceiver ported onto its
// connection internals: the UDP socket, the encryption key and DAVE decryption

export type VoiceConnection = ReturnType<typeof joinVoiceChannel>;

// discord voice gateway opcodes
const SPEAKING = 5;
const CLIENT_DISCONNECT = 13;

const RTP_OPUS_PAYLOAD_TYPE = 0x78;
const UNPADDED_NONCE_LENGTH = 4;
const AUTH_TAG_LENGTH = 16;
const HEADER_EXTENSION = Buffer.from([0xbe, 0xde]);

type Packet = { op: number; d: { user_id?: string; ssrc?: number } };
type ConnectionData = {
	encryptionMode?: string;
	secretKey?: Uint8Array;
};
type Dave = { decrypt(packet: Buffer, userId: string): Buffer | null };
type NetworkingState = {
	code: number;
	ws?: EventEmitter;
	udp?: EventEmitter;
	connectionData?: ConnectionData;
	dave?: Dave;
};
type Networking = EventEmitter & { state: NetworkingState };

// networking states that carry a working dave session
const READY = 4;
const RESUMING = 5;

const networkingOf = (connection: VoiceConnection) =>
	Reflect.get(connection.state, "networking") as Networking | undefined;

export class VoiceReceiver extends EventEmitter<{
	opus: [userId: string, packet: Buffer];
}> {
	private readonly ssrcs = new Map<number, string>();
	private readonly nonce = Buffer.alloc(12);
	private networking: Networking | undefined;
	private ws: EventEmitter | undefined;
	private udp: EventEmitter | undefined;
	private warnedMode = false;
	// discord-player strips every listener off the connection when a queue is
	// deleted, so the bindings are checked on a timer rather than on its events
	private readonly watchdog: NodeJS.Timeout;

	constructor(
		private readonly connection: VoiceConnection,
		private readonly wants: (userId: string) => boolean,
		// everyone in the call, to work out who an unannounced stream belongs to
		private readonly candidates: () => string[],
		private readonly stats: VoiceStats,
	) {
		super();
		this.onWsPacket = this.onWsPacket.bind(this);
		this.onUdpMessage = this.onUdpMessage.bind(this);
		this.onNetworkingState = this.onNetworkingState.bind(this);
		this.rebind();
		this.watchdog = setInterval(() => this.rebind(), 500);
	}

	destroy() {
		clearInterval(this.watchdog);
		this.networking?.off("stateChange", this.onNetworkingState);
		this.ws?.off("packet", this.onWsPacket);
		this.udp?.off("message", this.onUdpMessage);
		this.networking = this.ws = this.udp = undefined;
		this.removeAllListeners();
	}

	private rebind() {
		const networking = networkingOf(this.connection);
		if (networking !== this.networking) {
			this.networking?.off("stateChange", this.onNetworkingState);
			networking?.on("stateChange", this.onNetworkingState);
			this.networking = networking;
		}
		this.bindSockets(networking?.state);
	}

	private onNetworkingState(_old: NetworkingState, state: NetworkingState) {
		this.bindSockets(state);
	}

	private bindSockets(state: NetworkingState | undefined) {
		if (state?.ws !== this.ws) {
			this.ws?.off("packet", this.onWsPacket);
			state?.ws?.on("packet", this.onWsPacket);
			this.ws = state?.ws;
		}
		if (state?.udp !== this.udp) {
			this.udp?.off("message", this.onUdpMessage);
			state?.udp?.on("message", this.onUdpMessage);
			this.udp = state?.udp;
		}
	}

	private onWsPacket(packet: Packet) {
		const { user_id: userId, ssrc } = packet.d ?? {};
		if (packet.op === SPEAKING && userId && ssrc !== undefined) {
			if (this.ssrcs.get(ssrc) !== userId) this.stats.count("speakers mapped");
			this.ssrcs.set(ssrc, userId);
		} else if (packet.op === CLIENT_DISCONNECT && userId) {
			for (const [key, id] of this.ssrcs) {
				if (id === userId) this.ssrcs.delete(key);
			}
		}
	}

	private onUdpMessage(message: Buffer) {
		if (message.length <= 8) return;
		this.stats.count("udp in");
		const ssrc = message.readUInt32BE(8);
		const userId = this.ssrcs.get(ssrc) ?? this.identify(ssrc, message);
		if (!userId) return this.stats.count("unknown ssrc");
		if (!this.wants(userId)) return this.stats.count("not in call");
		if (((message[1] ?? 0) & 0x7f) !== RTP_OPUS_PAYLOAD_TYPE) {
			return this.stats.count("not opus");
		}
		if ((message[0] ?? 0) >> 6 !== 2) return this.stats.count("not rtp");

		try {
			const packet = this.parse(message, userId);
			if (packet) {
				this.stats.count("decrypted");
				this.emit("opus", userId, packet);
			} else {
				this.stats.count("dropped by dave");
			}
		} catch (error) {
			// a packet from before a key change, or a dave transition. Losing one
			// 20ms frame is inaudible, losing all of them is what the stats show
			this.stats.error("decrypt error", error);
		}
	}

	// discord says whose stream is whose (op 5) only once, around when they join
	// or start talking. A call joined after that, or the music's connection
	// from earlier, never hears it. So a stream nobody announced is matched to
	// someone in the call: by dave, whose keys only open their own sender's
	// audio, or by elimination when one person is left unaccounted for
	private identify(ssrc: number, message: Buffer) {
		const claimed = new Set(this.ssrcs.values());
		const options = this.candidates().filter((id) => !claimed.has(id));
		if (options.length === 0) return undefined;

		const state = this.networking?.state;
		const dave =
			state?.code === READY || state?.code === RESUMING
				? state.dave
				: undefined;
		const daveReady =
			dave &&
			Reflect.get(dave, "protocolVersion") !== 0 &&
			Boolean(Reflect.get(Reflect.get(dave, "session") ?? {}, "ready"));

		let found: string | undefined;
		if (daveReady) {
			for (const id of options) {
				try {
					if (this.parse(message, id)) {
						found = id;
						break;
					}
				} catch {
					// not theirs
				}
			}
		} else if (options.length === 1) {
			found = options[0];
		}
		if (!found) return undefined;
		this.ssrcs.set(ssrc, found);
		this.stats.count(daveReady ? "speakers found by dave" : "speakers guessed");
		return found;
	}

	private parse(message: Buffer, userId: string) {
		const state = this.networking?.state;
		const { encryptionMode, secretKey } = state?.connectionData ?? {};
		if (!encryptionMode || !secretKey) {
			this.stats.count("no key yet");
			return null;
		}
		if (encryptionMode !== "aead_aes256_gcm_rtpsize") {
			// discord-voip picks aes-gcm whenever node has it, which it always does
			if (!this.warnedMode) {
				console.warn(`[voice] can't hear: unsupported mode ${encryptionMode}`);
				this.warnedMode = true;
			}
			return null;
		}

		let packet = this.decrypt(message, secretKey);
		if ((message[0] ?? 0) & 0x20) {
			const padding = packet[packet.length - 1] ?? 0;
			if (padding < packet.length) {
				packet = packet.subarray(0, packet.length - padding);
			}
		}
		if (message.subarray(12, 14).equals(HEADER_EXTENSION)) {
			packet = packet.subarray(4 * message.readUInt16BE(14));
		}
		const dave =
			state?.code === READY || state?.code === RESUMING
				? state.dave
				: undefined;
		// null means a frame dave says to drop, never the still-encrypted bytes
		return dave ? dave.decrypt(packet, userId) : packet;
	}

	private decrypt(message: Buffer, secretKey: Uint8Array) {
		message.copy(this.nonce, 0, message.length - UNPADDED_NONCE_LENGTH);
		// the rtp header, plus the extension header when the x bit is set
		const headerSize = (message[0] ?? 0) & 0x10 ? 16 : 12;
		const end = message.length - UNPADDED_NONCE_LENGTH;
		const decipher = crypto.createDecipheriv(
			"aes-256-gcm",
			secretKey,
			this.nonce,
		);
		decipher.setAAD(message.subarray(0, headerSize));
		decipher.setAuthTag(message.subarray(end - AUTH_TAG_LENGTH, end));
		return Buffer.concat([
			decipher.update(message.subarray(headerSize, end - AUTH_TAG_LENGTH)),
			decipher.final(),
		]);
	}
}
