import type { ModelMessage } from "ai";

// what the models that keep notes and lore read: the chat as plain lines, each with who wrote it

export const textOf = ({ content }: ModelMessage) =>
	typeof content === "string"
		? content
		: content.map((part) => (part.type === "text" ? part.text : "")).join(" ");

// a reply sent as several messages is one assistant message, every line gets the name
export const transcriptOf = (chat: ModelMessage[], botName: string) =>
	chat
		.flatMap((msg) =>
			msg.role === "assistant"
				? textOf(msg)
						.split("\n")
						.map((line) => `${botName} (bot): ${line}`)
				: [textOf(msg)],
		)
		.join("\n");

// a person's lines start with their name, then ":" or " (replying to …)"
export const linesBy = (chat: ModelMessage[], name: string) =>
	chat
		.filter((msg) => msg.role === "user")
		.map(textOf)
		.filter(
			(text) => text.startsWith(`${name}:`) || text.startsWith(`${name} (`),
		);

const phrase = (text: string) =>
	(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");

// every quote has to appear in one of the lines, and together they need enough words
export const quotedFrom = (
	evidence: string,
	lines: string[],
	minWords: number,
) => {
	const quotes = evidence
		.split(/\n|\.{3}|…/)
		.map(phrase)
		.filter(Boolean);
	const words = quotes.join(" ").split(" ").filter(Boolean).length;
	if (quotes.length === 0 || words < minWords) return false;
	const source = lines.map(phrase);
	return quotes.every((quote) => source.some((line) => line.includes(quote)));
};
