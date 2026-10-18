import { setTimeout as sleep } from "node:timers/promises";

import { getSettings } from "@klyndre/config";
import { type FinishReason, generateText, type ModelMessage } from "ai";
import type {
	GuildTextBasedChannel,
	Message,
	MessageMentionOptions,
} from "discord.js";

import { CHAT_FLAGS } from "#/features/chat/history";

import { chatModel } from "#/features/chat/model";
import {
	firstWord,
	isSkip,
	openerHabit,
	type Turn,
} from "#/features/chat/openers";
import { type ChatContext, chatContext } from "#/features/chat/prompt";
import { pickReply } from "#/features/chat/variety";
import { chunk } from "#/lib/utils/text";

const DISCORD_MAX_LENGTH = 2000;
// per message after the first, however long it is
const FOLLOW_UP_TYPING_MIN_MS = 400;
const FOLLOW_UP_TYPING_MAX_MS = 2_000;

const allowedMentions: MessageMentionOptions = {
	parse: [],
	repliedUser: false,
};

const cleanReply = (botName: string, text: string) => {
	// grok sometimes leaks special tokens like <|eos|> into the text
	const reply = text.replace(/<\|[\w-]+\|>/g, "").trim();
	const prefix = `${botName}:`;
	return reply.toLowerCase().startsWith(prefix.toLowerCase())
		? reply.slice(prefix.length).trim()
		: reply;
};

// unicode emojis (with their joiners and variation selectors) and discord custom emojis
const EMOJI =
	/<a?:\w+:\d+>|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\u20e3/gu;

// one line per message, so the reply comes back joined with newlines
async function styleReply(guildId: string, text: string) {
	const { maxMessages, lowercaseReplies, stripEmojis } = await getSettings(
		guildId,
		"chat",
	);
	const style = (line: string) => {
		let styled = line;
		if (stripEmojis) styled = styled.replace(EMOJI, "");
		if (lowercaseReplies) styled = styled.toLowerCase();
		return styled.replace(/[ \t]{2,}/g, " ").trim();
	};
	return text
		.split("\n")
		.map(style)
		.filter(Boolean)
		.slice(0, maxMessages)
		.join("\n");
}

const hasImages = (history: ModelMessage[]) =>
	history.some(
		(msg) =>
			msg.role === "user" &&
			Array.isArray(msg.content) &&
			msg.content.some((part) => part.type === "file"),
	);

export const withoutImages = (history: ModelMessage[]): ModelMessage[] =>
	history.map((msg) =>
		msg.role === "user" && Array.isArray(msg.content)
			? { ...msg, content: msg.content.filter((part) => part.type !== "file") }
			: msg,
	);

// overrides for trying things out, the live bot uses the guild settings as they are
type GenerateOptions = { model?: string; temperature?: number };

async function generate(
	guildId: string,
	instructions: string,
	history: ModelMessage[],
	options: GenerateOptions,
) {
	const { model, temperature, maxReplyTokens } = await getSettings(
		guildId,
		"chat",
	);
	const run = (messages: ModelMessage[]) =>
		generateText({
			model: chatModel(options.model ?? model),
			instructions,
			messages,
			maxOutputTokens: maxReplyTokens,
			temperature: options.temperature ?? temperature,
		});

	try {
		return await run(history);
	} catch (error) {
		// usually an expired or unsupported image url, the text alone still works
		if (!hasImages(history)) throw error;
		console.warn("[chat] reply with images failed, retrying without", error);
		return run(withoutImages(history));
	}
}

// notes go after the last message, where the model actually acts on them
const withNote = (history: ModelMessage[], note: string): ModelMessage[] => {
	if (!note) return history;
	const text = `(note to you: ${note})`;
	const last = history.at(-1);
	if (last?.role !== "user")
		return [...history, { role: "user", content: text }];

	const content =
		typeof last.content === "string"
			? `${last.content}\n\n${text}`
			: [...last.content, { type: "text" as const, text }];
	return [...history.slice(0, -1), { ...last, content }];
};

export type Composed = {
	// what gets sent, empty when it stays quiet
	text: string;
	outcome: "reply" | "quiet" | "fallback" | "filtered";
	// of the generation it came from, "length" means it hit the token cap
	finishReason?: FinishReason;
	retried: boolean;
	// replies it chose between
	candidates: number;
};

// overrides for trying things out, like GenerateOptions
type ComposeOptions = GenerateOptions & { candidates?: number };

type Draft = { text: string; finishReason: FinishReason };

export async function composeReply(
	context: Pick<ChatContext, "guildId" | "botName">,
	instructions: string,
	history: ModelMessage[],
	turn: Turn,
	options: ComposeOptions = {},
): Promise<Composed> {
	const { guildId, botName } = context;
	const [
		{
			fallbackReply,
			contentFilterReply,
			skipMarker,
			skipNote,
			repeatedOpenerNote,
		},
		chat,
	] = await Promise.all([
		getSettings(guildId, "personality"),
		getSettings(guildId, "chat"),
	]);
	const habit = openerHabit(turn.recent, chat.openerRepeatLimit);
	const note = [
		habit && repeatedOpenerNote.replaceAll("{word}", habit),
		turn.canSkip && skipMarker && skipNote.replaceAll("{marker}", skipMarker),
	]
		.filter(Boolean)
		.join(" ");
	const none = { retried: false, candidates: 0 };
	const fallback = { text: fallbackReply, outcome: "fallback" } as const;

	// text is null when the content filter stopped it
	const attempt = async () => {
		const { text, finishReason } = await generate(
			guildId,
			instructions,
			withNote(history, note),
			options,
		);
		return {
			text:
				finishReason === "content-filter" ? null : cleanReply(botName, text),
			finishReason,
		};
	};

	try {
		// several at once take as long as one, and give it something to choose from
		const count = options.candidates ?? chat.candidates;
		const settled = await Promise.allSettled(
			Array.from({ length: count }, attempt),
		);
		const done = settled.flatMap((result) =>
			result.status === "fulfilled" ? [result.value] : [],
		);
		const failed = settled.find((result) => result.status === "rejected");
		if (done.length === 0 && failed) throw failed.reason;

		const allowed = done.filter((draft): draft is Draft => draft.text !== null);
		if (allowed.length === 0) {
			return { text: contentFilterReply, outcome: "filtered", ...none };
		}
		const skips = allowed.filter((draft) => isSkip(draft.text, skipMarker));
		const drafts = allowed.filter(
			(draft) => draft.text && !isSkip(draft.text, skipMarker),
		);

		// staying quiet when most of them would
		if (turn.canSkip && skips.length > 0 && skips.length >= drafts.length) {
			return {
				text: "",
				outcome: "quiet",
				...none,
				candidates: allowed.length,
			};
		}

		// when every one opens the usual way, one more try might not
		const retried =
			habit !== null &&
			drafts.length > 0 &&
			drafts.every((draft) => firstWord(draft.text) === habit);
		if (retried) {
			const retry = await attempt().catch(() => null);
			if (retry?.text && !isSkip(retry.text, skipMarker)) {
				drafts.push(retry as Draft);
			}
		}
		if (drafts.length === 0) return { ...fallback, ...none, retried };

		// an emoji-only reply styles down to nothing, which means stay quiet
		const styled = (
			await Promise.all(
				drafts.map(async (draft) => ({
					text: await styleReply(guildId, draft.text),
					finishReason: draft.finishReason,
				})),
			)
		).filter((draft) => draft.text);
		const tried = { retried, candidates: styled.length };
		if (styled.length === 0) return { text: "", outcome: "quiet", ...tried };

		const index = await pickReply(
			context,
			history,
			turn.recent,
			habit,
			styled.map(({ text, finishReason }) => ({
				text,
				hitCap: finishReason === "length",
			})),
		);
		const chosen = styled[index] ?? styled[0];
		return {
			text: chosen?.text ?? "",
			outcome: "reply",
			finishReason: chosen?.finishReason,
			...tried,
		};
	} catch (error) {
		console.error("[chat]", error);
		return { ...fallback, ...none };
	}
}

// one message per line, the first answering replyTo when there is one,
// the rest like someone typing a few messages in a row
export async function deliver(
	channel: GuildTextBasedChannel,
	text: string,
	replyTo?: Message<true>,
) {
	const { followUpTypingMs } = await getSettings(channel.guildId, "chat");
	const send = (content: string) =>
		channel.send({ content, allowedMentions, flags: CHAT_FLAGS });

	const [first = "", ...rest] = text.split("\n");
	for (const part of chunk(first, DISCORD_MAX_LENGTH)) {
		await (replyTo
			? replyTo.reply({ content: part, allowedMentions })
			: send(part));
	}
	for (const line of rest) {
		if (followUpTypingMs > 0) {
			await channel.sendTyping().catch(() => {});
			await sleep(
				Math.min(
					FOLLOW_UP_TYPING_MAX_MS,
					Math.max(FOLLOW_UP_TYPING_MIN_MS, line.length * followUpTypingMs),
				),
			);
		}
		for (const part of chunk(line, DISCORD_MAX_LENGTH)) await send(part);
	}
}

export async function sendReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
	turn: Turn,
): Promise<string | null> {
	// when it may stay quiet, typing first would give away a reply that never comes,
	// so it only types once it knows it's answering
	const showTyping = () => message.channel.sendTyping().catch(() => {});
	const typing = turn.canSkip ? undefined : setInterval(showTyping, 8_000);
	if (!turn.canSkip) await showTyping();

	try {
		const {
			text: reply,
			outcome,
			retried,
		} = await composeReply(chatContext(message), instructions, history, turn);
		if (retried)
			console.log("[chat] retried, every reply opened the usual way");
		if (outcome === "quiet") {
			console.log(`[chat] stayed quiet after "${message.cleanContent}"`);
		}
		if (!reply) return null;

		if (turn.canSkip) {
			const { quietTypingMs } = await getSettings(message.guildId, "chat");
			if (quietTypingMs > 0) {
				await showTyping();
				await sleep(quietTypingMs);
			}
		}

		await deliver(message.channel, reply, message);
		return reply;
	} finally {
		clearInterval(typing);
	}
}
