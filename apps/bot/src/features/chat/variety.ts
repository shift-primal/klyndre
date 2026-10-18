import { getSettings } from "@klyndre/config";
import { generateText, type ModelMessage } from "ai";

import { chatModel } from "#/features/chat/model";
import { firstWord } from "#/features/chat/openers";
import { textOf, transcriptOf } from "#/features/chat/transcript";
import { words } from "#/lib/utils/text";

// picking which of a few candidate replies to send, so it doesn't keep saying the same things

// the judge only sees the end of the chat, that's where repetition shows
const JUDGE_CONTEXT = 12;
// how much more repetitive than the best one a candidate can be and still go to the judge
const SHORTLIST_MARGIN = 2;

// a run of words straight after the same run, like "ok bro ok bro"
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
	// its own last replies, oldest first
	recent: string[];
	// the word its recent replies keep opening with, if any
	habit: string | null;
	// what people said, so echoing them doesn't count as repeating itself
	said: Set<string>;
};

// higher means more of the same: its usual opener, its own phrases and words again, loops
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
		getSettings(guildId, "chat"),
		getSettings(guildId, "personality"),
	]);
	const chat = transcriptOf(history.slice(-JUDGE_CONTEXT), botName);
	const own = recent.map((reply) => `- ${reply.replaceAll("\n", " / ")}`);
	const options = candidates.map(
		({ text }, i) => `${i + 1}. ${text.replaceAll("\n", " / ")}`,
	);

	// a bare number is quicker than structured output, and all it needs to say
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

// the index of the candidate to send
export async function pickReply(
	{ guildId, botName }: { guildId: string; botName: string },
	history: ModelMessage[],
	recent: string[],
	habit: string | null,
	candidates: Candidate[],
) {
	if (candidates.length < 2) return 0;

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

	const { judgeCandidates } = await getSettings(guildId, "chat");
	if (!judgeCandidates) return leastRepetitive;

	// the judge only chooses between the ones that don't clearly repeat themselves
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
