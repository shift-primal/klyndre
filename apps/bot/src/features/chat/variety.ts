import { getSettings } from "@klyndre/config";
import { generateText, type ModelMessage } from "ai";

import { chatModel } from "#/features/chat/model";
import { firstWord, openerHabit } from "#/features/chat/openers";
import { textOf, transcriptOf } from "#/features/chat/transcript";
import { words } from "#/lib/utils/text";

const JUDGE_CONTEXT = 12;
const SHORTLIST_MARGIN = 2;

export function isLoop(text: string) {
	const w = text.split(/\s+/);
	for (let size = 2; size * 2 <= w.length; size++) {
		for (let i = 0; i + size * 2 <= w.length; i++) {
			if (
				w.slice(i, i + size).join(" ") ===
				w.slice(i + size, i + size * 2).join(" ")
			) {
				return true;
			}
		}
	}
	return false;
}

const wordList = (text: string) =>
	text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

const phrases = (text: string, size: number) => {
	const list = wordList(text);
	const found = new Set<string>();
	for (let i = 0; i + size <= list.length; i++) {
		found.add(list.slice(i, i + size).join(" "));
	}
	return found;
};

export type Candidate = { text: string; hitCap: boolean };

type Context = {
	recent: string[];
	habit: string | null;
	said: Set<string>;
};

export function repetitionOf({ text, hitCap }: Candidate, context: Context) {
	let score = 0;
	const opener = firstWord(text);
	if (context.habit && opener === context.habit) score += 3;
	if (context.recent.some((reply) => firstWord(reply) === opener)) score += 1;

	const own = context.recent.join("\n");
	const ownPhrases = phrases(own, 3);
	for (const phrase of phrases(text, 3)) {
		if (ownPhrases.has(phrase)) score += 2;
	}
	const ownWords = words(own);
	for (const word of words(text)) {
		if ([...word].length >= 4 && ownWords.has(word) && !context.said.has(word))
			score += 0.5;
	}

	if (isLoop(text)) score += 10;
	if (hitCap) score += 5;
	return score;
}

async function judge(
	guildId: string,
	botName: string,
	history: ModelMessage[],
	recent: string[],
	candidates: Candidate[],
) {
	const [{ model }, { judgeInstructions }] = await Promise.all([
		getSettings(guildId, "replies"),
		getSettings(guildId, "internals"),
	]);
	const chat = transcriptOf(history.slice(-JUDGE_CONTEXT), botName);
	const own = recent.map((reply) => `- ${reply.replaceAll("\n", " / ")}`);
	const options = candidates.map(
		({ text }, i) => `${i + 1}. ${text.replaceAll("\n", " / ")}`,
	);

	const { text } = await generateText({
		model: chatModel(model),
		instructions: judgeInstructions.replaceAll("{name}", botName),
		messages: [
			{
				role: "user",
				content: [
					`## Chat\n${chat}`,
					own.length > 0 && `## ${botName}'s recent replies\n${own.join("\n")}`,
					`## Candidates\n${options.join("\n")}`,
					"Answer with only the number of the reply to send.",
				]
					.filter(Boolean)
					.join("\n\n"),
			},
		],
		temperature: 0,
		maxOutputTokens: 8,
	});
	const index = Number(text.match(/\d+/)?.[0] ?? 0) - 1;
	return index >= 0 && index < candidates.length ? index : null;
}

export async function pickReply(
	{ guildId, botName }: { guildId: string; botName: string },
	history: ModelMessage[],
	recent: string[],
	candidates: Candidate[],
) {
	if (candidates.length < 2) return 0;

	const habit = openerHabit(recent);
	const said = words(
		history
			.filter((msg) => msg.role === "user")
			.map(textOf)
			.join("\n"),
	);
	const scores = candidates.map((candidate) =>
		repetitionOf(candidate, { recent, habit, said }),
	);
	const leastRepetitive = scores.indexOf(Math.min(...scores));

	const best = scores[leastRepetitive] ?? 0;
	const shortlist = candidates
		.map((candidate, index) => ({ candidate, index }))
		.filter(({ index }) => (scores[index] ?? 0) <= best + SHORTLIST_MARGIN);
	if (shortlist.length < 2) return leastRepetitive;

	try {
		const picked = await judge(
			guildId,
			botName,
			history,
			recent,
			shortlist.map(({ candidate }) => candidate),
		);
		return picked === null
			? leastRepetitive
			: (shortlist[picked]?.index ?? leastRepetitive);
	} catch (error) {
		console.error("[chat] judge", error);
		return leastRepetitive;
	}
}
