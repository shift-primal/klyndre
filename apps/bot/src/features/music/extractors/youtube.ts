import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { getSecret } from "@klyndre/config";
import type { Track } from "discord-player";
import {
	getVideoId,
	type YoutubeExtractor,
	type YoutubeOptions,
} from "discord-player-youtubei";
import {
	createAdaptiveStreamMultiStep,
	createSabrStream,
} from "simple-ytdl-core";
import youtubeDl from "youtube-dl-exec";

const COOKIE_DOMAIN = /(^|\.)(youtube|google)\.com$/;
const COOKIE_COPY = join(tmpdir(), "yt-cookies.txt");

export const loadCookies = () => getSecret("youtube-cookies");

function cookieHeader(cookies: string) {
	const pairs: string[] = [];
	for (const raw of cookies.split("\n")) {
		const line = raw.replace(/^#HttpOnly_/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const [domain, , , , , name, value] = line.split("\t");
		if (domain && name && COOKIE_DOMAIN.test(domain.replace(/^\./, ""))) {
			pairs.push(`${name}=${value ?? ""}`);
		}
	}
	return pairs.join("; ");
}

type Opener = (
	videoId: string,
	track: Track,
	ext: YoutubeExtractor,
) => Promise<Readable>;

function innertube(ext: YoutubeExtractor) {
	if (!ext.innertube) throw new Error("YouTube isn't connected yet");
	return ext.innertube;
}

function ytdlp(cookiePath: string | undefined): Opener {
	return async (videoId, track) => {
		const dl = youtubeDl.exec(`https://youtu.be/${videoId}`, {
			format: track.live ? "best[height<=360]" : "bestaudio",
			output: "-",
			noWarnings: true,
			noProgress: true,
			jsRuntimes: "node",
			cookies: cookiePath,
		});
		if (!dl.stdout) throw new Error("yt-dlp gave no output stream");
		const audio = dl.stdout;
		dl.catch((error: unknown) => {
			if (!dl.killed) audio.destroy(error as Error);
		});
		audio.once("close", () => dl.kill());
		return audio;
	};
}

// a method hands its stream back before any audio has come through, and a
// blocked request only errors after that. Wait for the first chunk so a
// failure still falls through to the next method
function firstAudio(audio: Readable) {
	return new Promise<Readable>((resolve, reject) => {
		const onData = (chunk: Buffer) => {
			audio.off("data", onData).off("end", onEnd).off("error", reject);
			const out = new PassThrough();
			out.write(chunk);
			audio.on("error", (error) => out.destroy(error)).pipe(out);
			out.once("close", () => audio.destroy());
			resolve(out);
		};
		const onEnd = () => reject(new Error("ended before any audio"));
		audio.on("data", onData).once("end", onEnd).once("error", reject);
	});
}

export function youtubeOptions(cookies: string): YoutubeOptions {
	const hasCookies = Boolean(cookies.trim());
	if (hasCookies) {
		writeFileSync(COOKIE_COPY, cookies);
	} else {
		console.warn("No YouTube cookies set, playing YouTube without cookies");
	}

	// fastest first: adaptive streams in-process (~0.1s to audio), yt-dlp
	// spawns python (~2s), sabr is slowest (~4s)
	const methods: [string, Opener][] = [
		[
			"adaptive",
			(id, _track, ext) => createAdaptiveStreamMultiStep(innertube(ext), id),
		],
		["yt-dlp", ytdlp(hasCookies ? COOKIE_COPY : undefined)],
		["sabr", (id, _track, ext) => createSabrStream(innertube(ext), id)],
	];

	return {
		cookie: hasCookies ? cookieHeader(cookies) : undefined,
		async createStream(track, ext) {
			const videoId = getVideoId(track.url);
			for (const [name, open] of methods) {
				let audio: Readable | undefined;
				try {
					audio = await open(videoId, track, ext);
					return await firstAudio(audio);
				} catch (error) {
					audio?.destroy();
					const reason = error instanceof Error ? error.message : error;
					console.warn(
						`[music] ${name} couldn't stream "${track.title}":`,
						reason,
					);
				}
			}
			throw new Error(`Couldn't stream "${track.title}" from YouTube`);
		},
	};
}
