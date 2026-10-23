import type { ModelMessage } from "ai";

export const OPENER_MEMORY = 5;
export const OPENER_HABIT_LIMIT = 2;

export const firstWord = (text: string) =>
	text.toLowerCase().match(/[\p{L}\p{N}]+/u)?.[0] ?? "";

export const recentReplies = (history: ModelMessage[]) =>
	history
		.flatMap((msg) =>
			msg.role === "assistant" && typeof msg.content === "string"
				? [msg.content]
				: [],
		)
		.slice(-OPENER_MEMORY);

export const openerHabit = (recent: string[]) => {
	const counts = new Map<string, number>();
	for (const word of recent.map(firstWord).filter(Boolean)) {
		counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	const [word, times] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
	return word && times && times >= OPENER_HABIT_LIMIT ? word : null;
};
