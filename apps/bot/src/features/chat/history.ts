import { getSettings } from "@klyndre/config";
import type { FilePart, ModelMessage } from "ai";
import { type Message, MessageReferenceType } from "discord.js";

import type { People } from "#/features/chat/profiles";

export const RESET_MARKER = "🧹 Chat history cleared.";

// chat messages that don't reply to anything (the extra lines of a reply, a
// conversation it starts) end with this zero-width space. Nobody sees it, and it
// tells them apart from other bot messages like music announcements
export const CHAT_MARK = "\u200b";

const isUnansweringChat = (msg: Message<true>) =>
	!msg.reference && msg.content.endsWith(CHAT_MARK);

const textOf = (msg: Message<true>) =>
	msg.cleanContent.replaceAll(CHAT_MARK, "").trim();

const isReset = (msg: Message<true>, botId: string) =>
	msg.author.id === botId && msg.content.startsWith(RESET_MARKER);

const nameOf = (msg: Message<true>) =>
	msg.member?.displayName ?? msg.author.displayName;

const imagesOf = (msg: Message<true>): FilePart[] =>
	msg.attachments
		.filter((att) => att.contentType?.startsWith("image/"))
		.map(
			(att): FilePart => ({
				type: "file",
				data: new URL(att.url),
				mediaType: att.contentType ?? "image",
			}),
		);

const replyingTo = (
	msg: Message<true>,
	byId: ReadonlyMap<string, Message<true>>,
	botId: string,
) => {
	if (msg.reference?.type !== MessageReferenceType.Default) return null;
	const parent = byId.get(msg.reference.messageId ?? "");
	if (!parent) return null;
	return parent.author.id === botId ? "you" : nameOf(parent);
};

const toModelMessage = (
	msg: Message<true>,
	botId: string,
	images: FilePart[],
	speaker: string,
	marker: string,
): ModelMessage => {
	const text = textOf(msg);
	if (msg.author.id === botId) return { role: "assistant", content: text };

	const line = [`${speaker}: ${text}`, marker].filter(Boolean).join(" ");
	if (images.length === 0) return { role: "user", content: line };

	return { role: "user", content: [{ type: "text", text: line }, ...images] };
};

const belongsInChat = (
	msg: Message<true>,
	byId: ReadonlyMap<string, Message<true>>,
	botId: string,
	prefix: string,
) => {
	if (msg.author.id !== botId) return !msg.content.startsWith(prefix);
	if (msg.interactionMetadata) return false;
	if (isUnansweringChat(msg)) return true;

	const answered = byId.get(msg.reference?.messageId ?? "");
	return answered !== undefined && !answered.content.startsWith(prefix);
};

const replyChain = async (
	message: Message<true>,
	limit: number,
	known: ReadonlyMap<string, Message<true>>,
) => {
	const chain: Message<true>[] = [];
	let current = message;
	while (chain.length < limit && current.reference?.messageId) {
		const parent =
			known.get(current.reference.messageId) ??
			(await current.fetchReference().catch(() => null));
		if (!parent) break;
		chain.push(parent);
		current = parent;
	}
	return chain;
};

export const buildHistory = async (
	message: Message<true>,
): Promise<{
	messages: ModelMessage[];
	people: People;
	humanText: string;
	later: string[];
}> => {
	const [
		{ historyLimit, laterLimit, threadLimit, maxImages, imageMaxAgeMs },
		{ prefix },
		{ answeringMarker, replyLabel },
	] = await Promise.all([
		getSettings(message.guildId, "replies"),
		getSettings(message.guildId, "commands"),
		getSettings(message.guildId, "internals"),
	]);

	const { messages: channelMessages } = message.channel;
	const [before, after] = await Promise.all([
		channelMessages.fetch({ limit: historyLimit, before: message.id }),
		laterLimit > 0
			? channelMessages.fetch({ limit: laterLimit, after: message.id })
			: null,
	]);
	const chain = await replyChain(message, threadLimit, before);
	const botId = message.client.user.id;

	const earlier = [...before.values()];
	const reset = earlier.findIndex((msg) => isReset(msg, botId));
	const recent = reset === -1 ? earlier : earlier.slice(0, reset);
	const resetAt = earlier[reset]?.createdTimestamp ?? 0;

	const recentIds = new Set(recent.map((msg) => msg.id));
	const thread = chain.filter(
		(msg) => msg.createdTimestamp > resetAt && !recentIds.has(msg.id),
	);

	const all = [...(after?.values() ?? []), message, ...recent, ...thread].sort(
		(a, b) => b.createdTimestamp - a.createdTimestamp,
	);
	const byId = new Map(all.map((msg) => [msg.id, msg]));

	let imageBudget = maxImages;
	const kept: { msg: Message<true>; images: FilePart[] }[] = [];
	const people: People = new Map();

	for (const msg of all) {
		if (!belongsInChat(msg, byId, botId, prefix)) continue;

		const fresh =
			message.createdTimestamp - msg.createdTimestamp <= imageMaxAgeMs;
		const images =
			msg.author.id === botId || !fresh
				? []
				: imagesOf(msg).slice(0, imageBudget);
		imageBudget -= images.length;

		if (!textOf(msg) && images.length === 0) continue;
		if (!msg.author.bot) people.set(msg.author.id, nameOf(msg));
		kept.push({ msg, images });
	}

	const piledUp = kept[0]?.msg !== message;
	const speakerOf = (msg: Message<true>) => {
		const target = replyLabel && replyingTo(msg, byId, botId);
		return target
			? `${nameOf(msg)} ${replyLabel.replaceAll("{name}", target)}`
			: nameOf(msg);
	};
	const messages: ModelMessage[] = [];
	for (const { msg, images } of [...kept].reverse()) {
		const previous = messages.at(-1);
		if (
			msg.author.id === botId &&
			isUnansweringChat(msg) &&
			previous?.role === "assistant" &&
			typeof previous.content === "string"
		) {
			previous.content += `\n${textOf(msg)}`;
			continue;
		}
		messages.push(
			toModelMessage(
				msg,
				botId,
				images,
				speakerOf(msg),
				piledUp && msg === message ? answeringMarker : "",
			),
		);
	}

	const human = kept.filter(({ msg }) => !msg.author.bot);
	const humanText = human.map(({ msg }) => msg.cleanContent).join("\n");
	const later = human
		.filter(({ msg }) => msg.createdTimestamp > message.createdTimestamp)
		.map(({ msg }) => msg.id);
	return { messages, people, humanText, later };
};
