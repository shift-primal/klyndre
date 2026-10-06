import { getSettings } from "@klyndre/config";
import { type FinishReason, generateText, type ModelMessage } from "ai";
import type { Message, MessageMentionOptions } from "discord.js";
import { chatModel } from "#/features/chat/model";
import {
	firstWord,
	isSkip,
	openerHabit,
	type Turn,
} from "#/features/chat/openers";
import { type ChatContext, chatContext } from "#/features/chat/prompt";
import { chunk } from "#/lib/utils/text";

const DISCORD_MAX_LENGTH = 2000;

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

async function styleReply(guildId: string, text: string) {
	const { singleLineReplies, lowercaseReplies, stripEmojis } =
		await getSettings(guildId, "chat");
	let reply = text;
	if (stripEmojis) reply = reply.replace(EMOJI, "");
	if (singleLineReplies) {
		reply = reply.split("\n").find((line) => line.trim()) ?? "";
	}
	if (lowercaseReplies) reply = reply.toLowerCase();
	return reply.replace(/[ \t]{2,}/g, " ").trim();
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
export type GenerateOptions = { model?: string; temperature?: number };

async function generate(
	guildId: string,
	instructions: string,
	history: ModelMessage[],
	options: GenerateOptions,
) {
	const { model, maxReplyTokens } = await getSettings(guildId, "chat");
	const run = (messages: ModelMessage[]) =>
		generateText({
			model: chatModel(options.model ?? model),
			instructions,
			messages,
			maxOutputTokens: maxReplyTokens,
			temperature: options.temperature,
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
};

export async function composeReply(
	{ guildId, botName }: Pick<ChatContext, "guildId" | "botName">,
	instructions: string,
	history: ModelMessage[],
	turn: Turn,
	options: GenerateOptions = {},
): Promise<Composed> {
	const [
		{
			fallbackReply,
			contentFilterReply,
			skipMarker,
			skipNote,
			repeatedOpenerNote,
		},
		{ openerRepeatLimit },
	] = await Promise.all([
		getSettings(guildId, "personality"),
		getSettings(guildId, "chat"),
	]);
	const habit = openerHabit(turn.recent, openerRepeatLimit);
	const note = [
		habit && repeatedOpenerNote.replaceAll("{word}", habit),
		turn.canSkip && skipMarker && skipNote.replaceAll("{marker}", skipMarker),
	]
		.filter(Boolean)
		.join(" ");
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
		const first = await attempt();
		if (first.text === null) {
			return { text: contentFilterReply, outcome: "filtered", retried: false };
		}
		let { text, finishReason } = first;

		const retried =
			habit !== null && firstWord(text) === habit && !isSkip(text, skipMarker);
		if (retried) {
			const retry = await attempt().catch(() => null);
			if (retry?.text) ({ text, finishReason } = retry);
		}
		const tried = { finishReason, retried };

		if (!text) return { ...fallback, ...tried };
		if (isSkip(text, skipMarker)) {
			return turn.canSkip
				? { text: "", outcome: "quiet", ...tried }
				: { ...fallback, ...tried };
		}
		// an emoji-only reply styles down to nothing, which means stay quiet
		const styled = await styleReply(guildId, text);
		return { text: styled, outcome: styled ? "reply" : "quiet", ...tried };
	} catch (error) {
		console.error("[chat]", error);
		return { ...fallback, retried: false };
	}
}

export async function sendReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
	turn: Turn,
): Promise<string | null> {
	await message.channel.sendTyping();

	const typing = setInterval(
		() => message.channel.sendTyping().catch(() => {}),
		8_000,
	);

	try {
		const {
			text: reply,
			outcome,
			retried,
		} = await composeReply(chatContext(message), instructions, history, turn);
		if (retried)
			console.log("[chat] retried a reply that opened the usual way");
		if (outcome === "quiet") {
			console.log(`[chat] stayed quiet after "${message.cleanContent}"`);
		}
		if (!reply) return null;

		for (const part of chunk(reply, DISCORD_MAX_LENGTH)) {
			await message.reply({ content: part, allowedMentions });
		}
		return reply;
	} finally {
		clearInterval(typing);
	}
}
