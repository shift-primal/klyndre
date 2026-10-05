import type { Command } from "#/core/commands/types";
import { requireQueue } from "#/features/music/access";

export const stop: Command = {
	name: "stop",
	aliases: ["s", "dc"],
	description: "Stop playing, clear the queue and leave the voice channel",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		queue.delete();
		await ctx.reply(
			"Stopped the music and cleared the queue. Use `/restore` to bring it back.",
		);
	},
};
