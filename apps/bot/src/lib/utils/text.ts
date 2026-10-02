import { escapeMarkdown } from "discord.js";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}
