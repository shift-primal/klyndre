import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";
import { buildHistory } from "#/features/chat/history";
import { maybeUpdateLore, noteUsage, pickLore } from "#/features/chat/lore";
import {
	mayStayQuiet,
	recentReplies,
	type Turn,
} from "#/features/chat/openers";
import { maybeUpdateNotes } from "#/features/chat/profiles";
import { buildInstructions } from "#/features/chat/prompt";
import { sendReply } from "#/features/chat/reply";
import { inTurn } from "#/features/chat/turns";

export type ReplyReason = "mention" | "aiChannel" | "random";

export async function replyReason(
	message: Message<true>,
): Promise<ReplyReason | null> {
	if (message.author.bot) return null;
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
	if (!message.inGuild()) return;

	const reason = await replyReason(message);
	if (!reason) return;

	const { turnWaitLimitMs } = await getSettings(message.guildId, "chat");
	await inTurn(message.channelId, turnWaitLimitMs, async () => {
		const { messages, people, humanText } = await buildHistory(message);
		const lore = await pickLore(message, humanText);
		const { openerMemory, skipMaxWords } = await getSettings(
			message.guildId,
			"chat",
		);
		const recent = recentReplies(messages, openerMemory);
		const turn: Turn = {
			recent,
			canSkip:
				reason !== "mention" &&
				mayStayQuiet(message.cleanContent, recent, skipMaxWords),
		};
		const instructions = await buildInstructions(message, people, lore);
		const reply = await sendReply(message, instructions, messages, turn);

		void maybeUpdateNotes(message, people, messages);
		if (!reply) return;

		await noteUsage(message, lore.unprompted, reply);
		void maybeUpdateLore(message, messages, reply);
	});
};
