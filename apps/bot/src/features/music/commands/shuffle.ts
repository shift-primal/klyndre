import type { Command } from "#/core/commands/types";
import { refuse, requireQueue } from "#/features/music/access";

export const shuffle: Command = {
	name: "shuffle",
	aliases: ["shuff"],
	description: "Shuffle the queue",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.tracks.size < 2) {
			return refuse(ctx, "Not enough tracks in the queue to shuffle.");
		}

		queue.tracks.shuffle();
		await ctx.reply(`Shuffled ${queue.tracks.size} tracks.`);
	},
};
