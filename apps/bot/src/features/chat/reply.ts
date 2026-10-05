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
		const { model, maxReplyTokens } = await getSettings(
			message.guildId,
			"chat",
		);
		const { text } = await generateText({
			model: chatModel(model),
			instructions,
			messages: history,
			maxOutputTokens: maxReplyTokens,
		});

		const reply = cleanReply(message, text);
		if (!reply) return;

		for (const part of chunk(reply, DISCORD_MAX_LENGTH)) {
			await message.reply({ content: part, allowedMentions });
		}
	} finally {
		clearInterval(typing);
	}
}
