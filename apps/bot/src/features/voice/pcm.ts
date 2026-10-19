// All audio here is signed 16-bit little-endian PCM. Discord is 48kHz stereo,
// xAI is 24kHz mono (its default rate, so a misread format can't speed it up)

export const DISCORD_RATE = 48_000;
export const XAI_RATE = 24_000;
// one Discord voice frame: 20ms of 48kHz stereo
export const FRAME_SAMPLES = 960;
export const FRAME_MS = 20;
export const STEREO_FRAME_BYTES = FRAME_SAMPLES * 2 * 2;

export const clamp16 = (value: number) =>
	value > 32767 ? 32767 : value < -32768 ? -32768 : value;

export const samplesOf = (buffer: Buffer) =>
	new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length >> 1);

export const toBuffer = (samples: Int16Array) =>
	Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

// copies, so the result never shares (possibly unaligned) memory with the input
export const copySamples = (buffer: Buffer) => {
	const out = new Int16Array(buffer.length >> 1);
	for (let i = 0; i < out.length; i++) out[i] = buffer.readInt16LE(i * 2);
	return out;
};

// 48kHz stereo frame → 48kHz mono, added onto `into` (so speakers sum up)
export function addStereoAsMono(stereo: Buffer, into: Int32Array) {
	const frames = Math.min(stereo.length >> 2, into.length);
	for (let i = 0; i < frames; i++) {
		into[i] =
			(into[i] ?? 0) +
			((stereo.readInt16LE(i * 4) + stereo.readInt16LE(i * 4 + 2)) >> 1);
	}
}

// 48kHz mono → 24kHz mono, averaging each pair (a crude but adequate low-pass for speech)
export function downsampleHalf(mono: Int32Array): Buffer {
	const out = Buffer.alloc((mono.length >> 1) * 2);
	for (let i = 0; i < mono.length >> 1; i++) {
		const a = mono[i * 2] ?? 0;
		const b = mono[i * 2 + 1] ?? 0;
		out.writeInt16LE(clamp16((a + b) >> 1), i * 2);
	}
	return out;
}

// loudness of a 48kHz stereo frame, 0..32768
export function rms(stereo: Buffer) {
	const count = stereo.length >> 1;
	if (count === 0) return 0;
	let sum = 0;
	for (let i = 0; i < count; i++) {
		const sample = stereo.readInt16LE(i * 2);
		sum += sample * sample;
	}
	return Math.sqrt(sum / count);
}

// 24kHz mono → 48kHz mono by linear interpolation. Stateful across chunks so
// the joins don't click
export class Upsampler {
	private last: number | null = null;

	push(chunk: Buffer): Int16Array {
		const input = samplesOf(
			chunk.byteOffset % 2 === 0 ? chunk : Buffer.from(chunk), // Int16Array needs an aligned offset
		);
		const out = new Int16Array(input.length * 2);
		let previous = this.last ?? input[0] ?? 0;
		for (let i = 0; i < input.length; i++) {
			const sample = input[i] ?? 0;
			out[i * 2] = (previous + sample) >> 1;
			out[i * 2 + 1] = sample;
			previous = sample;
		}
		if (input.length > 0) this.last = previous;
		return out;
	}

	reset() {
		this.last = null;
	}
}
