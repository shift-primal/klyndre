import { getSettings } from "@klyndre/config";
import { generateText, type ModelMessage } from "ai";
import type { Message, MessageMentionOptions } from "discord.js";
import { chatModel } from "#/features/chat/model";
import { chunk } from "#/lib/utils/text";

const DISCORD_MAX_LENGTH = 2000;

const allowedMentions: MessageMentionOptions = {
	parse: [],
	repliedUser: false,
};

const cleanReply = (message: Message<true>, text: string) => {
	const name =
		message.guild.members.me?.displayName ?? message.client.user.username;
	const reply = text.trim();
	const prefix = `${name}:`;
	return reply.toLowerCase().startsWith(prefix.toLowerCase())
		? reply.slice(prefix.length).trim()
		: reply;
};

const hasImages = (history: ModelMessage[]) =>
	history.some(
		(msg) =>
			msg.role === "user" &&
			Array.isArray(msg.content) &&
			msg.content.some((part) => part.type === "file"),
	);

const withoutImages = (history: ModelMessage[]): ModelMessage[] =>
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

async function pickReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
) {
	const { fallbackReply, contentFilterReply } = await getSettings(
		message.guildId,
		"personality",
	);
	try {
		const { text, finishReason } = await generate(
			message.guildId,
			instructions,
			history,
		);
		if (finishReason === "content-filter") return contentFilterReply;
		return cleanReply(message, text) || fallbackReply;
	} catch (error) {
		console.error("[chat]", error);
		return fallbackReply;
	}
}

export async function sendReply(
	message: Message<true>,
	instructions: string,
	history: ModelMessage[],
): Promise<void> {
	await message.channel.sendTyping();

	const typing = setInterval(
		() => message.channel.sendTyping().catch(() => {}),
		8_000,
	);

	try {
		const reply = await pickReply(message, instructions, history);
		if (!reply) return;

		for (const part of chunk(reply, DISCORD_MAX_LENGTH)) {
			await message.reply({ content: part, allowedMentions });
		}
	} finally {
		clearInterval(typing);
	}
}
