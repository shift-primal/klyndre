import type { Command } from "#/core/commands/types";
import { RESET_MARKER } from "#/features/chat/history";

export const reset: Command = {
	name: "reset",
	description: "Make the AI forget the chat history in this channel",
	async run(ctx) {
		await ctx.reply(RESET_MARKER);
	},
};
