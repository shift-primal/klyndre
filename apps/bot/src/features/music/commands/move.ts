import type { Command } from "#/core/commands/types";
import {
	refuse,
	requireQueue,
	requireUpcomingTrack,
} from "#/features/music/access";
import { formatTrack } from "#/features/music/ui/format";

export const move: Command = {
	name: "move",
	aliases: ["mv"],
	description: "Move a track to another spot in the queue",
	arguments: [
		{
			name: "track",
			description: "Queue number or part of the title",
			required: true,
		},
		{
			name: "to",
			description: "The queue number to move it to",
			required: true,
		},
	],
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const match = /^(.+?)\s+(\d+)$/.exec(ctx.args.trim());
		if (!match?.[1] || !match[2]) {
			return refuse(
				ctx,
				"Tell me which track and where to put it, e.g. `move 5 1`.",
			);
		}

		const target = await requireUpcomingTrack(ctx, queue, "move", match[1]);
		if (!target) return;

		const to = Math.min(Math.max(Number(match[2]), 1), queue.tracks.size);
		if (to === target.position) {
			return refuse(ctx, `That track is already #${to}.`);
		}

		queue.moveTrack(target.track, to - 1);
		await ctx.reply(
			`↕️ **Moved** ${formatTrack(target.track)} from #${target.position} to #${to}.`,
		);
	},
};
