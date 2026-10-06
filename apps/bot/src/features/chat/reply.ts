import { getSettings } from "@klyndre/config";
import { generateText, type ModelMessage } from "ai";
import type { Message, MessageMentionOptions } from "discord.js";
import { chatModel } from "#/features/chat/model";
import {
	firstWord,
	isSkip,
	openerHabit,
	type Turn,
} from "#/features/chat/openers";
import { chunk } from "#/lib/utils/text";

const DISCORD_MAX_LENGTH = 2000;

const allowedMentions: MessageMentionOptions = {
	parse: [],
	repliedUser: false,
};

const cleanReply = (message: Message<true>, text: string) => {
	const name =
		message.guild.members.me?.displayName ?? message.client.user.username;
	// grok sometimes leaks special tokens like <|eos|> into the text
	const reply = text.replace(/<\|[\w-]+\|>/g, "").trim();
	const prefix = `${name}:`;
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

async function generate(
	guildId: string,
	instructions: string,
	history: ModelMessage[],
) {
	const { model, maxReplyTokens } = await getSettings(guildId, "chat");
	const run = (messages: ModelMessage[]) =>
		generateText({
			model: chatModel(model),
			instructions,
			messages,
			maxOutputTokens: maxReplyTokens,
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

async function pickReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
	turn: Turn,
) {
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
		getSettings(message.guildId, "personality"),
		getSettings(message.guildId, "chat"),
	]);
	const habit = openerHabit(turn.recent, openerRepeatLimit);
	const note = [
		habit && repeatedOpenerNote.replaceAll("{word}", habit),
		turn.canSkip && skipMarker && skipNote.replaceAll("{marker}", skipMarker),
	]
		.filter(Boolean)
		.join(" ");

	// null when the content filter stopped it
	const attempt = async () => {
		const { text, finishReason } = await generate(
			message.guildId,
			instructions,
			withNote(history, note),
		);
		return finishReason === "content-filter" ? null : cleanReply(message, text);
	};

	try {
		let reply = await attempt();
		if (reply === null) return contentFilterReply;

		// one more try when it opens the way it keeps opening anyway
		if (habit && firstWord(reply) === habit && !isSkip(reply, skipMarker)) {
			console.log(`[chat] retrying a reply that opens with "${habit}" again`);
			const retry = await attempt().catch(() => null);
			if (retry) reply = retry;
		}

		if (isSkip(reply, skipMarker)) {
			if (!turn.canSkip) return fallbackReply;
			console.log(`[chat] stayed quiet after "${message.cleanContent}"`);
			return "";
		}
		// an emoji-only reply styles down to nothing, which means stay quiet
		return reply ? await styleReply(message.guildId, reply) : fallbackReply;
	} catch (error) {
		console.error("[chat]", error);
		return fallbackReply;
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
		const reply = await pickReply(message, instructions, history, turn);
		if (!reply) return null;

		for (const part of chunk(reply, DISCORD_MAX_LENGTH)) {
			await message.reply({ content: part, allowedMentions });
		}
		return reply;
	} finally {
		clearInterval(typing);
	}
}
