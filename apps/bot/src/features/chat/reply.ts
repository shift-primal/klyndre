import { setTimeout as sleep } from "node:timers/promises";

import { getSettings } from "@klyndre/config";
import { type FinishReason, generateText, type ModelMessage } from "ai";
import type {
	GuildTextBasedChannel,
	Message,
	MessageMentionOptions,
} from "discord.js";

import { CHAT_MARK } from "#/features/chat/history";

import { chatModel } from "#/features/chat/model";
import { recentReplies } from "#/features/chat/openers";
import { type ChatContext, chatContext } from "#/features/chat/prompt";
import { pickReply } from "#/features/chat/variety";
import { chunk } from "#/lib/utils/text";

const DISCORD_MAX_LENGTH = 2000;
const FOLLOW_UP_TYPING_MIN_MS = 400;
const FOLLOW_UP_TYPING_MAX_MS = 2_000;

const ONE_LINE_NOTE = "write just one line this time.";
const severalLinesNote = (lines: number) =>
	`you may write up to ${lines} short lines this time; each line is sent as its own message.`;

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

const EMOJI =
	/<a?:\w+:\d+>|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\u20e3/gu;

async function styleReply(guildId: string, text: string, maxMessages: number) {
	const { lowercaseReplies, stripEmojis } = await getSettings(guildId, "style");
	const style = (line: string) => {
		let styled = line;
		if (stripEmojis) styled = styled.replace(EMOJI, "");
		if (lowercaseReplies) styled = styled.toLowerCase();
		return styled.replace(/[ \t]{2,}/g, " ").trim();
	};
	const lines = text.split("\n").map(style).filter(Boolean);
	return maxMessages === 1
		? lines.join(" ")
		: lines.slice(0, maxMessages).join("\n");
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

type GenerateOptions = { model?: string; temperature?: number };

async function generate(
	guildId: string,
	instructions: string,
	history: ModelMessage[],
	options: GenerateOptions,
) {
	const { model, temperature, maxReplyTokens } = await getSettings(
		guildId,
		"replies",
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
		if (!hasImages(history)) throw error;
		console.warn("[chat] reply with images failed, retrying without", error);
		return run(withoutImages(history));
	}
}

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
	text: string;
	outcome: "reply" | "fallback" | "filtered";
	finishReason?: FinishReason;
	candidates: number;
};

type ComposeOptions = GenerateOptions & { candidates?: number };

type Draft = { text: string; finishReason: FinishReason };

export async function composeReply(
	context: Pick<ChatContext, "guildId" | "botName">,
	instructions: string,
	history: ModelMessage[],
	options: ComposeOptions = {},
): Promise<Composed> {
	const { guildId, botName } = context;
	const [{ fallbackReply, contentFilterReply, candidates }, style] =
		await Promise.all([
			getSettings(guildId, "replies"),
			getSettings(guildId, "style"),
		]);
	const maxMessages =
		style.maxMessages > 1 && Math.random() < style.multiMessageChance
			? style.maxMessages
			: 1;
	const note =
		maxMessages === 1 ? ONE_LINE_NOTE : severalLinesNote(maxMessages);
	const fallback = {
		text: fallbackReply,
		outcome: "fallback",
		candidates: 0,
	} as const;

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
		const count = options.candidates ?? candidates;
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
			return { text: contentFilterReply, outcome: "filtered", candidates: 0 };
		}

		const styled = (
			await Promise.all(
				allowed.map(async (draft) => ({
					text: await styleReply(guildId, draft.text, maxMessages),
					finishReason: draft.finishReason,
				})),
			)
		).filter((draft) => draft.text);
		if (styled.length === 0) return fallback;

		const index = await pickReply(
			context,
			history,
			recentReplies(history),
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
			candidates: styled.length,
		};
	} catch (error) {
		console.error("[chat]", error);
		return fallback;
	}
}

export async function deliver(
	channel: GuildTextBasedChannel,
	text: string,
	replyTo?: Message<true>,
) {
	const { followUpTypingMs } = await getSettings(channel.guildId, "style");
	const send = (content: string) =>
		channel.send({ content: `${content}${CHAT_MARK}`, allowedMentions });
	const size = DISCORD_MAX_LENGTH - CHAT_MARK.length;

	const [first = "", ...rest] = text.split("\n");
	for (const part of chunk(first, size)) {
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
		for (const part of chunk(line, size)) await send(part);
	}
}

export async function sendReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
): Promise<Composed | null> {
	const showTyping = () => message.channel.sendTyping().catch(() => {});
	const typing = setInterval(showTyping, 8_000);

	try {
		const composed = await composeReply(
			chatContext(message),
			instructions,
			history,
		);
		if (!composed.text) return null;

		await deliver(message.channel, composed.text, message);
		return composed;
	} finally {
		clearInterval(typing);
	}
}
