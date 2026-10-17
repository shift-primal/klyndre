import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import {
	type GuildQueue,
	onBeforeCreateStream,
	type Player,
	QueryResolver,
	type Track,
} from "discord-player";

// opening a song's audio can take ~10s when YouTube makes the server wait out
// an ad, so the next song in the queue starts opening shortly before the
// current one ends and is handed over when it comes up

// enough to cover the slowest way of opening a song, and short enough that the
// opened stream doesn't sit idle long enough for YouTube to drop it
const LEAD_MS = 20_000;
// a preloaded song that never came up (skipped past, moved, queue stopped) is
// closed after this
const KEEP_MS = 2 * 60_000;

interface Preload {
	track: Track;
	stream: Promise<Readable | null>;
	expires: NodeJS.Timeout;
}

const preloads = new Map<string, Preload>();
const timers = new Map<string, NodeJS.Timeout>();
// guilds whose current song is close enough to its end that the next one
// should be open, so queue changes swap what's preloaded
const due = new Set<string>();

// opens the stream the way discord-player does when the song comes up: the
// first extractor that takes the link streams it, a Spotify song by finding it
// on YouTube
async function open(player: Player, track: Track) {
	const session = {
		id: randomUUID(),
		attemptedExtractors: new Set<string>(),
		bridgeAttemptedExtractors: new Set<string>(),
	};
	const type = track.queryType ?? QueryResolver.resolve(track.url).type;
	const result = await player.extractors.context.provide(session, () =>
		player.extractors.run(async (extractor) => {
			if (!(await extractor.validate(track.url, type))) return false;
			return extractor.stream(track);
		}),
	);
	const streamable = result?.result;
	if (streamable instanceof Readable) return streamable;
	// a link or a stream with a format hint: leave it to discord-player
	if (streamable && typeof streamable === "object") streamable.stream.destroy();
	return null;
}

function drop(guildId: string) {
	const preload = preloads.get(guildId);
	if (!preload) return;
	preloads.delete(guildId);
	clearTimeout(preload.expires);
	preload.stream.then((stream) => stream?.destroy());
}

function preloadNext(player: Player, queue: GuildQueue) {
	const guildId = queue.guild.id;
	const next = queue.tracks.at(0);
	if (preloads.get(guildId)?.track === next) return;
	drop(guildId);
	if (!next) return;

	console.log(`[music] preloading "${next.title}"`);
	const stream = open(player, next).catch((error: unknown) => {
		console.warn(
			`[music] couldn't preload "${next.title}":`,
			error instanceof Error ? error.message : error,
		);
		return null;
	});
	const expires = setTimeout(() => {
		if (preloads.get(guildId)?.track === next) drop(guildId);
	}, KEEP_MS);
	preloads.set(guildId, { track: next, stream, expires });
}

function stop(guildId: string) {
	clearTimeout(timers.get(guildId));
	timers.delete(guildId);
	due.delete(guildId);
	drop(guildId);
}

export function registerPreload(player: Player) {
	onBeforeCreateStream(async (track, _type, queue) => {
		const preload = preloads.get(queue.guild.id);
		if (preload?.track !== track) return null;
		preloads.delete(queue.guild.id);
		clearTimeout(preload.expires);
		// still opening if the song was skipped to: waiting for it beats
		// starting over. null when preloading failed, so it's opened as usual
		const stream = await preload.stream;
		if (stream) console.log(`[music] using preloaded "${track.title}"`);
		return stream;
	});

	player.events.on("playerStart", (queue, track) => {
		const guildId = queue.guild.id;
		stop(guildId);
		if (!track.durationMS) return;
		const timer = setTimeout(
			() => {
				timers.delete(guildId);
				due.add(guildId);
				preloadNext(player, queue);
			},
			Math.max(0, track.durationMS - LEAD_MS),
		);
		timers.set(guildId, timer);
	});

	const changed = (queue: GuildQueue) => {
		if (due.has(queue.guild.id)) preloadNext(player, queue);
	};
	player.events.on("audioTrackAdd", changed);
	player.events.on("audioTracksAdd", changed);
	player.events.on("audioTrackRemove", changed);
	player.events.on("audioTracksRemove", changed);

	for (const event of ["emptyQueue", "queueDelete", "disconnect"] as const) {
		player.events.on(event, (queue) => stop(queue.guild.id));
	}
}
