import type { Command } from "#/core/commands/types";
import { enqueue } from "#/features/music/enqueue";

export const playNow: Command = {
	name: "playnow",
	aliases: ["pnow"],
	description: "Skip the current song and play this one now, keeping the queue",
	arguments: [
		{
			name: "song",
			description: "The song to play right now",
			required: true,
		},
	],
	run: (ctx) => enqueue(ctx, "now"),
};
