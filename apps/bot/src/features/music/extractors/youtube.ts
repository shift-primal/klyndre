import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, type Readable } from "node:stream";

import { getSecret } from "@klyndre/config";
import {
	type ExtractorSearchContext,
	Playlist,
	QueryType,
	Track,
} from "discord-player";
import {
	buildPlaylistUrl,
	buildTracks,
	buildVideoUrl,
	getInnertube,
	getSearchContext,
	getVideo,
	getVideoId,
	isTrackLikeNode,
	runWithSearchContext,
	YoutubeExtractor,
	type YoutubeOptions,
} from "discord-player-youtubei";
import {
	createAdaptiveStreamMultiStep,
	createSabrStream,
} from "simple-ytdl-core";
import { ProxyAgent } from "undici";
import youtubeDl from "youtube-dl-exec";
import { Innertube } from "youtubei.js";

import { env } from "#/env";

const COOKIE_DOMAIN = /(^|\.)(youtube|google)\.com$/;
const COOKIE_COPY = join(tmpdir(), "yt-cookies.txt");

export const loadCookies = () => getSecret("youtube-cookies");

export function cookieHeader(cookies: string) {
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

const reason = (error: unknown) =>
	error instanceof Error ? error.message : error;

type Opener = (
	videoId: string,
	track: Track,
	ext: YoutubeExtractor,
) => Promise<Readable>;

function innertube(ext: YoutubeExtractor) {
	if (!ext.innertube) throw new Error("YouTube isn't connected yet");
	return ext.innertube;
}

// yt-dlp prints why it failed (bot check, region block, age gate) to stderr
function ytdlpError(stderr: string) {
	const lines = stderr
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const errors = lines.filter((line) => line.startsWith("ERROR"));
	const reason = (errors.length > 0 ? errors : lines.slice(-3)).join(" | ");
	return new Error(reason.slice(0, 500) || "yt-dlp exited without audio");
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

		let stderr = "";
		dl.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		// hold the end back until yt-dlp exits, so a failure arrives as its own
		// message instead of a bare "ended before any audio"
		const audio = new PassThrough();
		dl.stdout.pipe(audio, { end: false });
		dl.then(
			() => audio.end(),
			() => {
				if (!dl.killed) audio.destroy(ytdlpError(stderr));
			},
		);
		audio.once("close", () => dl.kill());
		return audio;
	};
}

// sends every request through the proxy. YouTube ties each audio link to the
// IP that asked for it, so the audio has to come through the same way
export function proxiedFetch(proxy: string): typeof fetch {
	const dispatcher = new ProxyAgent(proxy);
	return (input, init) => fetch(input, { ...init, dispatcher } as RequestInit);
}

// adaptive streams through a YouTube session of its own, made at startup so the
// first song doesn't wait for it. A failed stream drops the session, so the
// next song starts on a fresh one
function adaptive(cookie: string | undefined, proxy?: string): Opener {
	const through = proxy ? proxiedFetch(proxy) : undefined;
	let session: Promise<Innertube> | undefined;
	const fresh = () => {
		const created = Innertube.create({
			retrieve_player: true,
			cookie,
			fetch: through,
		});
		session = created;
		created.catch(() => {
			if (session === created) session = undefined;
		});
		return created;
	};
	fresh();

	return async (videoId) => {
		const used = session ?? fresh();
		try {
			return await createAdaptiveStreamMultiStep(await used, videoId);
		} catch (error) {
			if (session === used) session = undefined;
			throw error;
		}
	};
}

// when every method fails, ask YouTube directly why it won't serve the video
async function playability(ext: YoutubeExtractor, videoId: string) {
	try {
		const info = await innertube(ext).getBasicInfo(videoId);
		const status = info.playability_status;
		if (!status) return "no playability status";
		return [status.status, status.reason].filter(Boolean).join(": ");
	} catch (error) {
		return `couldn't check: ${error instanceof Error ? error.message : error}`;
	}
}

// a method that keeps failing (adaptive behind a bot check) would make every
// song wait for it to give up, so after a couple of failures in a row it moves
// to the back for a while, then gets tried first again
const FAILS_BEFORE_REST = 2;
const REST_MS = 30 * 60_000;

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

// a method with a time limit is cut off when it runs over (an offline home
// connection just hangs), and whatever it hands back afterwards is closed
async function firstAudioWithin(
	open: () => Promise<Readable>,
	timeoutMs: number | undefined,
) {
	let audio: Readable | undefined;
	let gaveUp = false;
	const attempt = open().then((opened) => {
		audio = opened;
		if (gaveUp) opened.destroy();
		return firstAudio(opened);
	});
	let timer: NodeJS.Timeout | undefined;
	const overtime = new Promise<never>((_, reject) => {
		if (!timeoutMs) return;
		timer = setTimeout(() => {
			gaveUp = true;
			reject(new Error(`no audio within ${timeoutMs}ms`));
		}, timeoutMs);
	});
	try {
		return await Promise.race([attempt, overtime]);
	} catch (error) {
		audio?.destroy();
		attempt.then(
			(stream) => stream.destroy(),
			() => {},
		);
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

interface Method {
	name: string;
	open: Opener;
	timeoutMs?: number;
}

// streaming through home takes well under a second. When it hasn't started by
// this, home is offline and the song moves on to the next method
const HOME_TIMEOUT_MS = 3000;

export function youtubeOptions(cookies: string): YoutubeOptions {
	const hasCookies = Boolean(cookies.trim());
	if (hasCookies) {
		writeFileSync(COOKIE_COPY, cookies);
	} else {
		console.warn("No YouTube cookies set, playing YouTube without cookies");
	}

	// fastest first. adaptive streams in-process (~0.1s to audio), but YouTube
	// won't give the server's datacenter IP any audio that way, so it goes
	// through the home proxy when there is one. yt-dlp works from the server
	// with cookies but spawns python and sits out the video's pre-roll ad
	// (5-10s), sabr is slowest
	const cookie = hasCookies ? cookieHeader(cookies) : undefined;
	const methods: Method[] = [
		...(env.YOUTUBE_PROXY
			? [
					{
						name: "home",
						open: adaptive(cookie, env.YOUTUBE_PROXY),
						timeoutMs: HOME_TIMEOUT_MS,
					},
				]
			: []),
		{ name: "adaptive", open: adaptive(cookie) },
		{ name: "yt-dlp", open: ytdlp(hasCookies ? COOKIE_COPY : undefined) },
		{
			name: "sabr",
			open: (id, _track, ext) => createSabrStream(innertube(ext), id),
		},
	];

	const failures = new Map<string, { inARow: number; lastAt: number }>();
	const resting = ({ name }: Method) => {
		const failed = failures.get(name);
		return (
			!!failed &&
			failed.inARow >= FAILS_BEFORE_REST &&
			Date.now() - failed.lastAt < REST_MS
		);
	};
	const fail = (name: string) => {
		const inARow = (failures.get(name)?.inARow ?? 0) + 1;
		failures.set(name, { inARow, lastAt: Date.now() });
		if (inARow === FAILS_BEFORE_REST) {
			console.warn(
				`[music] ${name} failed ${inARow} times in a row, trying it last for ${REST_MS / 60_000} minutes`,
			);
		}
	};

	return {
		cookie: hasCookies ? cookieHeader(cookies) : undefined,
		async createStream(track, ext) {
			const videoId = getVideoId(track.url);
			const started = performance.now();
			const elapsed = () => `${Math.round(performance.now() - started)}ms`;
			const order = [
				...methods.filter((method) => !resting(method)),
				...methods.filter(resting),
			];
			for (const { name, open, timeoutMs } of order) {
				try {
					const stream = await firstAudioWithin(
						() => open(videoId, track, ext),
						timeoutMs,
					);
					failures.delete(name);
					console.log(
						`[music] ${name} streamed "${track.title}" (${elapsed()})`,
					);
					return stream;
				} catch (error) {
					console.warn(
						`[music] ${name} couldn't stream "${track.title}" (${elapsed()}):`,
						reason(error),
					);
					fail(name);
				}
			}
			const status = await playability(ext, videoId);
			console.warn(`[music] YouTube says for "${track.title}": ${status}`);
			throw new Error(`Couldn't stream "${track.title}" from YouTube`);
		},
	};
}

// every shape of link people paste: watch, youtu.be, shorts, live, embed, and
// the m. and music. hosts. null when it isn't a YouTube link
function parseLink(query: string) {
	let url: URL;
	try {
		url = new URL(query.trim());
	} catch {
		return null;
	}
	const host = url.hostname.replace(/^(www|m|music)\./, "");
	if (host !== "youtube.com" && host !== "youtu.be") return null;

	const [first, second] = url.pathname.split("/").filter(Boolean);
	let videoId: string | null = null;
	if (host === "youtu.be") videoId = first ?? null;
	else if (first === "watch") videoId = url.searchParams.get("v");
	else if (["shorts", "live", "embed"].includes(first ?? "")) {
		videoId = second ?? null;
	}
	return { videoId, listId: url.searchParams.get("list") };
}

interface LockupLike {
	type: string;
	metadata?: {
		metadata?: {
			metadata_rows?: { metadata_parts?: { text?: { text?: string } }[] }[];
		};
	};
	content_image?: { overlays?: { badges?: { text?: string }[] }[] };
}

// playlists now list their videos as LockupViews, which the extractor only
// reads the title from. The channel is the first metadata line and the length
// is a badge on the thumbnail
function fillFromLockup(track: Track, node: unknown) {
	const lockup = node as LockupLike;
	if (lockup.type !== "LockupView") return;

	track.author ||=
		lockup.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text
			?.text ?? "";
	track.duration ||=
		lockup.content_image?.overlays
			?.flatMap((overlay) => overlay.badges ?? [])
			.map((badge) => badge.text ?? "")
			.find((text) => /^\d+(:\d\d)+$/.test(text)) ?? "";
}

async function loadPlaylist(listId: string, ext: YoutubeExtractor) {
	let page = await (await getInnertube()).getPlaylist(listId);
	const playlist = new Playlist(ext.context.player, {
		title: page.info.title ?? "Unknown playlist",
		thumbnail: page.info.thumbnails?.at(0)?.url ?? "",
		description: page.info.description ?? "",
		author: {
			name: page.info.author?.name ?? "",
			url: page.info.author?.url ?? "",
		},
		tracks: [],
		id: listId,
		url: buildPlaylistUrl(listId),
		type: "playlist",
		source: "youtube",
		rawPlaylist: page,
	});

	for (;;) {
		const nodes = page.videos.filter(isTrackLikeNode);
		const tracks = buildTracks(nodes, ext, playlist);
		for (const [index, track] of tracks.entries()) {
			fillFromLockup(track, nodes[index]);
		}
		playlist.tracks.push(...tracks);
		if (!page.has_continuation) return playlist;
		page = await page.getContinuation();
	}
}

interface OEmbed {
	title?: string;
	author_name?: string;
	thumbnail_url?: string;
}

// when YouTube bot-checks our session the video details come back empty (the
// "Played: []" lines). oEmbed is public and still has the title and channel
async function loadVideo(videoId: string, ext: YoutubeExtractor) {
	const track = await getVideo(videoId, ext).catch((error: unknown) => {
		console.warn(`[music] Couldn't get details for ${videoId}:`, reason(error));
		return null;
	});
	if (track?.title) return track;

	const url = buildVideoUrl(videoId);
	const res = await fetch(
		`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
	);
	if (!res.ok) {
		if (track) return track;
		throw new Error(`Couldn't find the YouTube video ${videoId}`);
	}
	const details = (await res.json()) as OEmbed;
	return new Track(ext.context.player, {
		title: details.title,
		author: details.author_name,
		thumbnail: details.thumbnail_url,
		url,
		requestedBy: getSearchContext().requestedBy,
		source: "youtube",
		queryType: QueryType.YOUTUBE_VIDEO,
	});
}

export class CustomYoutubeExtractor extends YoutubeExtractor {
	override async handle(query: string, context: ExtractorSearchContext) {
		const link = parseLink(query);
		if (!link) return super.handle(query, context);
		const { videoId, listId } = link;

		return runWithSearchContext(context, async () => {
			// a mix (RD...) is a radio YouTube made from the video, not a playlist
			// anyone picked, so a link into one plays just the video. A private
			// or broken playlist falls back to the video too
			if (listId && !(videoId && listId.startsWith("RD"))) {
				try {
					const playlist = await loadPlaylist(listId, this);
					if (playlist.tracks.length > 0) {
						return this.createResponse(playlist, playlist.tracks);
					}
				} catch (error) {
					if (!videoId) throw error;
					console.warn(
						`[music] Couldn't load playlist ${listId}:`,
						reason(error),
					);
				}
			}
			if (!videoId) return this.createResponse(null, []);
			return this.createResponse(null, [await loadVideo(videoId, this)]);
		});
	}
}
