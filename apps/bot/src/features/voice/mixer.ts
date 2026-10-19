import { pipeline, type Readable, Transform } from "node:stream";

import { type GuildQueue, StreamType } from "discord-player";

import type { VoiceOutput } from "#/features/voice/output";

// the live voice output of each server with a call going
export const outputs = new Map<string, VoiceOutput>();

// every song's pcm (48kHz stereo s16le) passes through here on its way to the
// encoder. With a call going, the AI's voice is added and the song turned
// down; without one, the audio passes through untouched
class MusicMixer extends Transform {
	private remainder: Buffer | null = null;

	constructor(private readonly guildId: string) {
		super({ highWaterMark: 4 * 3840 });
	}

	override _transform(
		chunk: Buffer,
		_encoding: BufferEncoding,
		callback: (error?: Error | null, data?: Buffer) => void,
	) {
		const data = this.remainder
			? Buffer.concat([this.remainder, chunk])
			: chunk;
		// ffmpeg's chunks don't always end on a whole stereo sample
		const whole = data.length - (data.length % 4);
		this.remainder = whole < data.length ? data.subarray(whole) : null;
		const music = data.subarray(0, whole);

		const output = outputs.get(this.guildId);
		callback(null, output ? output.mixMusic(music) : music);
	}
}

// discord-player's onAfterCreateStream hook. Needs ffmpeg in the path (the
// player's skipFFmpeg is off) so the stream is always raw pcm
export async function mixWithVoice(stream: Readable, queue: GuildQueue) {
	const mixer = new MusicMixer(queue.guild.id);
	// pipeline, so a failed source ends the mixer and the player moves on
	pipeline(stream, mixer, () => {});
	return { stream: mixer, type: StreamType.Raw };
}
