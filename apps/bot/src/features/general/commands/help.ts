import type { Command } from "#/core/commands/types";
import { chatCommands } from "#/features/chat/commands";
import { generalCommands } from "#/features/general/commands";
import { musicCommands } from "#/features/music/commands";
import { formatArgument } from "#/lib/utils/text";

export const help: Command = {
	name: "help",
	aliases: ["h", "?"],
	description: "Show help and list available commands",
	anyChannel: true,
	async run(ctx) {
		const allCommands = [...musicCommands, ...chatCommands, ...generalCommands];
		const lines = allCommands.map((cmd) => {
			if (cmd.slashOnly) return `**/${cmd.name}**\n-# ${cmd.description}`;

			const arg = cmd.argument ? ` \`${formatArgument(cmd.argument)}\`` : "";
			const aliases = cmd.aliases?.length
				? ` (${cmd.aliases.map((alias) => `${alias}`).join(", ")})`
				: "";

			return `**${cmd.name}**${arg}${aliases}\n-# ${cmd.description}`;
		});

		lines.push("\nEvery command also works as a slash command, e.g. `/play`.");

		await ctx.reply(lines.join("\n \n"));
	},
};
