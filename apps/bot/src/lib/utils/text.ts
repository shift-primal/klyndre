import { escapeMarkdown } from "discord.js";
import type { Command } from "#/core/commands/types";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function formatArgument(argument: NonNullable<Command["argument"]>) {
	return argument.required ? `<${argument.name}>` : `[${argument.name}]`;
}
