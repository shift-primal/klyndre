import { escapeMarkdown } from "discord.js";
import type { CommandArgument } from "#/core/commands/types";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function formatArguments(args: CommandArgument[] = []) {
	return args
		.map((arg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`))
		.join(" ");
}

export function words(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.split(/[^\p{L}\p{N}]+/u)
			.filter(Boolean),
	);
}

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
