import type { ModelMessage } from "ai";

export type Turn = {
	// its own last replies in this channel, oldest first
	recent: string[];
	// tagged replies always answer, anything else may stay quiet
	canSkip: boolean;
};

export const firstWord = (text: string) =>
	text.toLowerCase().match(/[\p{L}\p{N}]+/u)?.[0] ?? "";

export const recentReplies = (history: ModelMessage[], count: number) =>
	count === 0
		? []
		: history
				.flatMap((msg) =>
					msg.role === "assistant" && typeof msg.content === "string"
						? [msg.content]
						: [],
				)
				.slice(-count);

export const openerHabit = (recent: string[], limit: number) => {
	if (limit === 0) return null;
	const counts = new Map<string, number>();
	for (const word of recent.map(firstWord).filter(Boolean)) {
		counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	const [word, times] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
	return word && times && times >= limit ? word : null;
};

// only after a short message like "ok" or "will do", and never when it just asked something
export const mayStayQuiet = (
	text: string,
	recent: string[],
	maxWords: number,
) =>
	maxWords > 0 &&
	(text.match(/[\p{L}\p{N}]+/gu) ?? []).length <= maxWords &&
	!recent.at(-1)?.trim().endsWith("?");

// the model sometimes wraps the marker in other text, so it only has to appear
export const isSkip = (reply: string, marker: string) =>
	marker !== "" && reply.toLowerCase().includes(marker.toLowerCase());
