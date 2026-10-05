import type { Command } from "#/core/commands/types";
import { enqueue } from "#/features/music/enqueue";

export const play: Command = {
	name: "play",
	aliases: ["p"],
	description: "Play a song in a voice channel",
	arguments: [
		{ name: "song", description: "The song to play", required: true },
	],
	run: (ctx) => enqueue(ctx, "end"),
};
