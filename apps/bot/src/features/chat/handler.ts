import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";

export type ReplyReason = "mention" | "aiChannel" | "random";

export async function replyReason(
	message: Message,
): Promise<ReplyReason | null> {
	if (message.author.bot || !message.inGuild()) return null;
	if (!message.content && message.attachments.size === 0) return null;

	const { prefix } = await getSettings(message.guildId, "commands");
	if (message.content.startsWith(prefix)) return null;

	const me = message.client.user;
	if (message.mentions.has(me, { ignoreEveryone: true, ignoreRoles: true })) {
		return "mention";
	}

	const channels = await getSettings(message.guildId, "channels");
	if (channels.aiChannelIds.includes(message.channelId)) return "aiChannel";

	if (channels.randomReplyChannelIds.includes(message.channelId)) {
		const { randomReplyChance } = await getSettings(message.guildId, "chat");
		if (Math.random() < randomReplyChance) return "random";
	}

	return null;
}

export const handleMessage = async (message: Message) => {
	const reason = await replyReason(message);
	if (!reason) return;

	await message.reply("hei");
};
