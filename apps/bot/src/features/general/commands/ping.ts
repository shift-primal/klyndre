import type { Command } from "#/core/commands/types";

export const ping: Command = {
	name: "ping",
	description: "Pong! (Used to test if the bot is online)",
	anyChannel: true,
	async run(ctx) {
		await ctx.reply("Pong!");
	},
};
