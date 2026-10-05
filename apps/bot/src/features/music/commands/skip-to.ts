import type { Command } from "#/core/commands/types";
import {
	refuse,
	requireQueue,
	requireUpcomingTrack,
} from "#/features/music/access";
import { skipToTrack } from "#/features/music/skip";
import { formatTrack } from "#/features/music/ui/format";

export const skipTo: Command = {
	name: "skipto",
	aliases: ["st", "goto"],
	description: "Skip to a track in the queue, by its number or name",
	arguments: [
		{
			name: "track",
			description: "Queue number or part of the title",
			required: true,
		},
	],
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const target = await requireUpcomingTrack(ctx, queue, "skip to");
		if (!target) return;

		if (!skipToTrack(queue, target.track)) {
			return refuse(ctx, "Could not skip to that track.");
		}

		await ctx.reply(
			`⏭️ **Skipped to #${target.position}:** ${formatTrack(target.track)}`,
		);
	},
};
