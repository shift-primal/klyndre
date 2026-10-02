import type { Command } from "#/core/commands/types";
import { requireQueue } from "#/features/music/access";
import { skipCurrent } from "#/features/music/skip";
import { formatTrack } from "#/features/music/ui/format";

export const skip: Command = {
	name: "skip",
	aliases: ["n", "next"],
	description: "Skip the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const skipped = queue.currentTrack;
		const hasNext = queue.tracks.size > 0;
		skipCurrent(queue);

		const lines = [`⏭️ **Skipped:** ${formatTrack(skipped)}`];
		if (!hasNext) lines.push("The queue is now empty.");
		await ctx.reply(lines.join("\n"));
	},
};
