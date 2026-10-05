import { getSettings } from "@klyndre/config";
import { useMainPlayer, useQueue } from "discord-player";
import type { Command } from "#/core/commands/types";
import { refuse, requireVoiceChannel } from "#/features/music/access";
import { queueOptions } from "#/features/music/queue-options";
import { forgetSavedQueue, getSavedQueue } from "#/features/music/saved-queues";
import type { QueueMetadata } from "#/features/music/types";
import { formatTrack } from "#/features/music/ui/format";

export const restore: Command = {
	name: "restore",
	aliases: ["undo", "unstop"],
	description: "Bring back the queue from the last time the music stopped",
	async run(ctx) {
		const musicSettings = await getSettings(ctx.guild.id, "music");
		const saved = getSavedQueue(ctx.guild.id, musicSettings.restoreWindowMs);
		const [first] = saved?.tracks ?? [];
		if (!saved || !first) {
			return refuse(ctx, "There is no stopped queue to bring back.");
		}
		if (useQueue(ctx.guild)?.currentTrack) {
			return refuse(ctx, "Something is already playing.");
		}

		const voiceChannel = await requireVoiceChannel(ctx);
		if (!voiceChannel) return;

		await ctx.defer();

		const metadata: QueueMetadata = { channel: ctx.channel };
		const queue = useMainPlayer().nodes.create(ctx.guild, {
			metadata,
			...queueOptions(musicSettings),
		});
		if (!queue.channel) await queue.connect(voiceChannel);

		queue.addTrack(saved.tracks);
		queue.setRepeatMode(saved.repeatMode);
		forgetSavedQueue(ctx.guild.id);
		await queue.node.play();

		const rest = saved.tracks.length - 1;
		await ctx.reply(
			`⏪ **Restored the queue:** ${formatTrack(first)}${rest > 0 ? ` and ${rest} more` : ""}`,
		);
	},
};
