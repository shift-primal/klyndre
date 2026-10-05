import { QueueRepeatMode } from "discord-player";
import type { Command } from "#/core/commands/types";
import { refuse, requireQueue } from "#/features/music/access";

const MODES: Record<string, { mode: QueueRepeatMode; label: string }> = {
	off: { mode: QueueRepeatMode.OFF, label: "🔁 Loop is off." },
	track: {
		mode: QueueRepeatMode.TRACK,
		label: "🔂 Looping the current track.",
	},
	queue: { mode: QueueRepeatMode.QUEUE, label: "🔁 Looping the queue." },
};

export const loop: Command = {
	name: "loop",
	aliases: ["repeat"],
	description: "Loop the current track or the whole queue",
	argument: { name: "mode", description: "off, track or queue" },
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const input = ctx.args.trim().toLowerCase();
		const choice = MODES[input];
		if (input && !choice) {
			return refuse(ctx, "The mode must be `off`, `track` or `queue`.");
		}

		const next =
			choice ??
			(queue.repeatMode === QueueRepeatMode.OFF
				? MODES.track
				: queue.repeatMode === QueueRepeatMode.TRACK
					? MODES.queue
					: MODES.off);
		if (!next) return;

		queue.setRepeatMode(next.mode);
		await ctx.reply(next.label);
	},
};
