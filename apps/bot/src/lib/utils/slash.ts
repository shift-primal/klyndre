import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "#/types";

export function toSlashJSON(command: Command) {
	const builder = new SlashCommandBuilder()
		.setName(command.name)
		.setDescription(command.description)
		.setContexts(InteractionContextType.Guild);

	const arg = command.argument;
	if (arg) {
		builder.addStringOption((option) =>
			option
				.setName(arg.name)
				.setDescription(arg.description)
				.setRequired(arg.required ?? false),
		);
	}
	return builder.toJSON();
}
