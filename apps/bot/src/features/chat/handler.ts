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
import { buildInstructions, chatContext } from "#/features/chat/prompt";
import { sendReply } from "#/features/chat/reply";
import { inTurn } from "#/features/chat/turns";

type ReplyReason = "mention" | "aiChannel" | "random";

// typing @bot often picks the bot's own role (same name) from the suggestions,
// which isn't a user mention
function isTagged(message: Message<true>) {
	const me = message.client.user;
	if (message.mentions.has(me, { ignoreEveryone: true, ignoreRoles: true })) {
		return true;
	}
	const botRole = message.guild.members.me?.roles.botRole;
	return Boolean(botRole && message.mentions.roles.has(botRole.id));
}

async function replyReason(
	message: Message<true>,
): Promise<ReplyReason | null> {
	if (message.author.bot) return null;
	if (!message.content && message.attachments.size === 0) return null;

	const { prefix } = await getSettings(message.guildId, "commands");
	if (message.content.startsWith(prefix)) return null;

	const channels = await getSettings(message.guildId, "channels");
	const inAiChannel = channels.aiChannelIds.includes(message.channelId);

	if (isTagged(message)) {
		const { replyToMentionsAnywhere } = await getSettings(
			message.guildId,
			"chat",
		);
		if (replyToMentionsAnywhere || inAiChannel) return "mention";
	}

	if (inAiChannel) return "aiChannel";

	if (channels.randomReplyChannelIds.includes(message.channelId)) {
		const { randomReplyChance } = await getSettings(message.guildId, "chat");
		if (Math.random() < randomReplyChance) return "random";
	}

	return null;
}

// per channel, what its last reply read that came in after the message it answered.
// answering those again just repeats that reply, so only a tag gets another one
const alreadyRead = new Map<string, Set<string>>();

export const handleMessage = async (message: Message) => {
	if (!message.inGuild()) return;

	const reason = await replyReason(message);
	if (!reason) return;

	const { turnWaitLimitMs } = await getSettings(message.guildId, "chat");
	await inTurn(message.channelId, turnWaitLimitMs, async () => {
		if (
			reason !== "mention" &&
			alreadyRead.get(message.channelId)?.has(message.id)
		) {
			console.log(
				`[chat] skipped "${message.cleanContent}", the last reply read it`,
			);
			return;
		}

		const { messages, people, humanText, later } = await buildHistory(message);
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
		const instructions = await buildInstructions(
			chatContext(message),
			people,
			lore,
		);
		const reply = await sendReply(message, instructions, messages, turn);

		void maybeUpdateNotes(message, people, messages);
		if (!reply) return;

		alreadyRead.set(message.channelId, new Set(later));
		await noteUsage(message, lore.unprompted, reply);
		void maybeUpdateLore(message, messages, reply);
	});
};
