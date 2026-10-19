import { getSettings } from "@klyndre/config";
import type { VoiceBasedChannel } from "discord.js";
import {
	type GuildQueue,
	QueryResolver,
	useMainPlayer,
	useQueue,
} from "discord-player";

import type { CommandContext } from "#/core/commands/types";
import { requireVoiceChannel } from "#/features/music/access";
import { queueOptions } from "#/features/music/queue-options";
import { skipCurrent } from "#/features/music/skip";
import type { QueueMetadata } from "#/features/music/types";
import { formatPlaylist, formatTrack } from "#/features/music/ui/format";

type EnqueueMode = "end" | "next" | "now";

const SPOTIFY_WEB_LINK = /^https?:\/\/open\.spotify\.com\//;

// discord-player only knows track, album and playlist links. Anything else on
// open.spotify.com (a typo'd path, a bad id, an artist or episode) falls back to
// searching the URL as text and plays whatever that happens to match
function isUnplayableSpotifyLink(query: string) {
	const link = query.trim();
	if (!SPOTIFY_WEB_LINK.test(link)) return false;
	return !QueryResolver.resolve(link).type.startsWith("spotify");
}

function isNoResult(error: unknown) {
	return (error as { code?: string } | null)?.code === "ERR_NO_RESULT";
}

export async function enqueue(ctx: CommandContext, mode: EnqueueMode) {
	const voiceChannel = await requireVoiceChannel(ctx);
	if (!voiceChannel) return;

	await ctx.defer();

	if (isUnplayableSpotifyLink(ctx.args)) {
		await ctx.reply(
			"That Spotify link doesn't point to anything I can play. Use a track, album or playlist link (Share → Copy link in Spotify).",
		);
		return;
	}

	try {
		const queue = useQueue(ctx.guild);

		if (mode === "end" || !queue?.currentTrack) {
			await playAtEnd(ctx, voiceChannel);
		} else {
			await playAhead(ctx, queue, mode);
		}
	} catch (error) {
		if (isNoResult(error)) {
			await ctx.reply(`No results found for "${ctx.args}".`);
			return;
		}
		console.error(error);
		await ctx.reply("An error occurred while playing the song!");
	}
}

async function playAtEnd(ctx: CommandContext, voiceChannel: VoiceBasedChannel) {
	const metadata: QueueMetadata = { channel: ctx.channel };
	const musicSettings = await getSettings(ctx.guild.id, "music");
	const { track, queue, searchResult } = await useMainPlayer().play(
		voiceChannel,
		ctx.args,
		{
			requestedBy: ctx.member.user,
			nodeOptions: { metadata, ...queueOptions(musicSettings) },
		},
	);
	const { playlist } = searchResult;
	const position =
		queue.tracks.toArray().findIndex((t) => t.id === track.id) + 1;
	// not in the upcoming list means it's the one playing, or still loading
	// as the first track (currentTrack is only set once its audio is ready)
	const isPlayingNow = position === 0;

	// a song that starts right away gets the now playing message, so there's
	// nothing to add about it
	const lines = [
		playlist &&
			`📃 **Added playlist** ${formatPlaylist(playlist)} · ${playlist.tracks.length} tracks`,
		!isPlayingNow &&
			`➕ **${playlist ? "Starts at" : "Added to queue"} #${position}:** ${formatTrack(track)}`,
	].filter(Boolean);

	if (lines.length === 0) {
		await ctx.dismiss();
		return;
	}
	await ctx.reply(lines.join("\n"));
}

async function playAhead(
	ctx: CommandContext,
	queue: GuildQueue,
	mode: "next" | "now",
) {
	const search = await useMainPlayer().search(ctx.args, {
		requestedBy: ctx.member.user,
	});
	if (!search.hasTracks()) {
		await ctx.reply(`No results found for "${ctx.args}".`);
		return;
	}

	const { playlist } = search;
	const tracks = playlist ? search.tracks : search.tracks.slice(0, 1);
	const [first] = tracks;
	if (!first) return;

	tracks.forEach((track, index) => {
		queue.insertTrack(track, index);
	});
	if (mode === "now") skipCurrent(queue);

	const label = mode === "now" ? "▶️ **Playing now:**" : "⏭️ **Playing next:**";
	const lines = [`${label} ${formatTrack(first)}`];
	if (playlist) {
		lines.unshift(
			`📃 **Added playlist** ${formatPlaylist(playlist)} · ${tracks.length} tracks at the top of the queue`,
		);
	}
	await ctx.reply(lines.join("\n"));
}
