import { getSettings } from "@klyndre/config";
import type { VoiceBasedChannel } from "discord.js";
import { type GuildQueue, useMainPlayer, useQueue } from "discord-player";
import type { CommandContext } from "#/core/commands/types";
import { requireVoiceChannel } from "#/features/music/access";
import { queueOptions } from "#/features/music/queue-options";
import { skipCurrent } from "#/features/music/skip";
import type { QueueMetadata } from "#/features/music/types";
import { formatPlaylist, formatTrack } from "#/features/music/ui/format";

type EnqueueMode = "end" | "next" | "now";

export async function enqueue(ctx: CommandContext, mode: EnqueueMode) {
	const voiceChannel = await requireVoiceChannel(ctx);
	if (!voiceChannel) return;

	await ctx.defer();

	try {
		const queue = useQueue(ctx.guild);

		if (mode === "end" || !queue?.currentTrack) {
			await playAtEnd(ctx, voiceChannel);
		} else {
			await playAhead(ctx, queue, mode);
		}
	} catch (error) {
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
	const isPlayingNow = queue.currentTrack?.id === track.id;
	const position =
		queue.tracks.toArray().findIndex((t) => t.id === track.id) + 1;

	const trackLine = isPlayingNow
		? `🔥 Time to play some bangers 🔥`
		: `➕ **${playlist ? "Starts at" : "Added to queue"} #${position}:** ${formatTrack(track)}`;

	await ctx.reply(
		playlist
			? `📃 **Added playlist** ${formatPlaylist(playlist)} · ${playlist.tracks.length} tracks\n${trackLine}`
			: trackLine,
	);
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
