import type { ModelMessage } from "ai";

export const OPENER_MEMORY = 5;
export const HABIT_LIMIT = 2;

export const firstWord = (text: string) =>
	text.toLowerCase().match(/[\p{L}\p{N}]+/u)?.[0] ?? "";

export const closingWords = (text: string) =>
	text
		.split("\n")
		.map(
			(line) =>
				line
					.toLowerCase()
					.match(/[\p{L}\p{N}]+/gu)
					?.at(-1) ?? "",
		)
		.filter(Boolean);

export const recentReplies = (history: ModelMessage[]) =>
	history
		.flatMap((msg) =>
			msg.role === "assistant" && typeof msg.content === "string"
				? [msg.content]
				: [],
		)
		.slice(-OPENER_MEMORY);

const habitIn = (wordsPerReply: string[][]) => {
	const counts = new Map<string, number>();
	for (const word of wordsPerReply.flatMap((list) => [...new Set(list)])) {
		counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	const [word, times] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
	return word && times && times >= HABIT_LIMIT ? word : null;
};

export const openerHabit = (recent: string[]) =>
	habitIn(recent.map((reply) => [firstWord(reply)].filter(Boolean)));

export const closerHabit = (recent: string[]) =>
	habitIn(recent.map(closingWords));
