import type { Command } from "#/core/commands/types";
import { requireQueue, requireUpcomingTrack } from "#/features/music/access";
import { formatTrack } from "#/features/music/ui/format";

export const remove: Command = {
	name: "remove",
	aliases: ["rm"],
	description: "Remove a track from the queue, by its number or name",
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

		const target = await requireUpcomingTrack(ctx, queue, "remove");
		if (!target) return;

		queue.removeTrack(target.track);
		await ctx.reply(
			`🗑️ **Removed #${target.position}:** ${formatTrack(target.track)}`,
		);
	},
};
