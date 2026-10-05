import type { Command } from "#/core/commands/types";
import { RESET_MARKER } from "#/features/chat/history";
import { clearNotes } from "#/features/chat/profiles";

export const reset: Command = {
	name: "reset",
	description:
		"Make the AI forget the chat history in this channel and its notes on you",
	async run(ctx) {
		const cleared = await clearNotes(ctx.guild.id, ctx.member.id);
		await ctx.reply(
			cleared ? `${RESET_MARKER} Your notes were wiped too.` : RESET_MARKER,
		);
	},
};
