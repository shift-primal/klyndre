import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";

import {
	maybeFillCharacter,
	maybeUpdateCharacter,
} from "#/features/chat/character";
import { buildHistory } from "#/features/chat/history";
import {
	maybeUpdateLore,
	noteStoriesUsed,
	noteUsage,
	pickLore,
	pickStories,
} from "#/features/chat/lore";
import { maybeUpdateNotes } from "#/features/chat/profiles";
import { buildInstructions, chatContext } from "#/features/chat/prompt";
import { sendReply } from "#/features/chat/reply";
import { inTurn } from "#/features/chat/turns";

type ReplyReason = "mention" | "aiChannel" | "random" | "notHere";

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

	const replies = await getSettings(message.guildId, "replies");
	const inAiChannel = replies.aiChannelIds.includes(message.channelId);

	const tagged = isTagged(message);
	if (tagged && (replies.replyToMentionsAnywhere || inAiChannel)) {
		return "mention";
	}

	if (inAiChannel) return "aiChannel";

	if (replies.randomReplyChannelIds.includes(message.channelId)) {
		return Math.random() < replies.randomReplyChance ? "random" : null;
	}

	return tagged ? "notHere" : null;
}

const alreadyRead = new Map<string, Set<string>>();

const seconds = (from: number, to: number) =>
	`${((to - from) / 1000).toFixed(1)}s`;

export const handleMessage = async (message: Message) => {
	if (!message.inGuild()) return;
	const received = performance.now();

	const reason = await replyReason(message);
	if (!reason) return;

	if (reason === "notHere") {
		const { notHereReply } = await getSettings(message.guildId, "replies");
		if (notHereReply) await message.reply(notHereReply);
		return;
	}

	const { turnWaitLimitMs } = await getSettings(message.guildId, "replies");
	await inTurn(message.channelId, turnWaitLimitMs, async () => {
		const started = performance.now();
		if (
			reason !== "mention" &&
			alreadyRead.get(message.channelId)?.has(message.id)
		) {
			console.log(
				`[chat] skipped "${message.cleanContent}", the last reply read it`,
			);
			return;
		}

		void message.channel.sendTyping().catch(() => {});

		const context = chatContext(message);
		void maybeFillCharacter(context);
		const { messages, people, humanText, later } = await buildHistory(message);
		const read = performance.now();
		const [lore, stories] = await Promise.all([
			pickLore(message, humanText),
			pickStories(message.guildId, humanText),
		]);
		const instructions = await buildInstructions(
			context,
			people,
			lore,
			stories,
		);
		const prompted = performance.now();
		const sent = await sendReply(message, instructions, messages);
		if (sent) {
			const now = performance.now();
			console.log(
				`[chat] answered in ${seconds(received, now)}: waiting ${seconds(received, started)}, reading the chat ${seconds(started, read)}, prompt ${seconds(read, prompted)}, writing and sending ${seconds(prompted, now)}`,
			);
		}

		void maybeUpdateNotes(message, people, messages);
		if (!sent) return;

		alreadyRead.set(message.channelId, new Set(later));
		await noteUsage(message, lore.unprompted, sent.text);
		void maybeUpdateLore(message, messages, sent.text);
		if (sent.outcome !== "reply") return;
		await noteStoriesUsed(stories).catch((error) =>
			console.error("[chat]", error),
		);
		void maybeUpdateCharacter(context, messages, sent.text);
	});
};
