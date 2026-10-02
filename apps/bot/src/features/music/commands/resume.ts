import type { Command } from "#/core/commands/types";
import { refuse, requireQueue } from "#/features/music/access";

export const resume: Command = {
	name: "resume",
	aliases: ["res"],
	description: "Resume the paused track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (!queue.node.isPaused()) return refuse(ctx, "Nothing is paused.");

		queue.node.setPaused(false);
		await ctx.reply("▶️ Resumed.");
	},
};
