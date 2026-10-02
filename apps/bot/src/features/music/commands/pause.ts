import type { Command } from "#/core/commands/types";
import { refuse, requireQueue } from "#/features/music/access";

export const pause: Command = {
	name: "pause",
	description: "Pause the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.node.isPaused()) return refuse(ctx, "Already paused.");

		queue.node.setPaused(true);
		await ctx.reply("⏸️ Paused.");
	},
};
