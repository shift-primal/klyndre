import { getSettings } from "@klyndre/config";
import { useMainPlayer } from "discord-player";
import type { Command } from "#/core/commands/types";
import { refuse, requireVoiceChannel } from "#/features/music/access";
import { queueOptions } from "#/features/music/queue-options";
import type { QueueMetadata } from "#/features/music/types";
import { formatPlaylist, formatTrack } from "#/features/music/ui/format";

export const play: Command = {
	name: "play",
	aliases: ["p"],
	description: "Play a song in a voice channel",
	argument: { name: "song", description: "The song to play", required: true },
	async run(ctx) {
		if (!ctx.args.trim()) {
			await refuse(ctx, "Tell me what to play, e.g. a song name or a link.");
			return;
		}

		const voiceChannel = await requireVoiceChannel(ctx);
		if (!voiceChannel) return;

		await ctx.defer();

		try {
			const settings = await getSettings(ctx.guild.id, "music");
			const metadata: QueueMetadata = { channel: ctx.channel };
			const { track, queue, searchResult } = await useMainPlayer().play(
				voiceChannel,
				ctx.args,
				{
					requestedBy: ctx.member.user,
					nodeOptions: { metadata, ...queueOptions(settings) },
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
		} catch (error) {
			console.error("[play]", error);
			await ctx.reply("An error occurred while playing the song!");
		}
	},
};
