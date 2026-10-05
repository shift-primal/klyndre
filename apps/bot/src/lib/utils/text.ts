import { escapeMarkdown } from "discord.js";
import type { Command } from "#/core/commands/types";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function formatArgument(argument: NonNullable<Command["argument"]>) {
	return argument.required ? `<${argument.name}>` : `[${argument.name}]`;
}

// splits text into pieces of at most `size` chars, preferring to break on newlines
export function chunk(text: string, size: number): string[] {
	const chunks: string[] = [];
	let rest = text;
	while (rest.length > size) {
		const newline = rest.lastIndexOf("\n", size);
		const cut = newline > 0 ? newline : size;
		chunks.push(rest.slice(0, cut));
		rest = rest.slice(cut).trimStart();
	}
	if (rest) chunks.push(rest);
	return chunks;
}
