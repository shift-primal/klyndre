import { getSettings } from "@klyndre/config";
import type { FilePart, ModelMessage } from "ai";
import { type Message, MessageReferenceType } from "discord.js";
import type { People } from "#/features/chat/profiles";

// the reset command replies with this, and history stops reading at it
export const RESET_MARKER = "🧹 Chat history cleared.";

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

// who a discord reply is aimed at, without it "du" is guesswork for the model
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
	const text = msg.cleanContent.trim();
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

	const answered = byId.get(msg.reference?.messageId ?? "");
	return answered !== undefined && !answered.content.startsWith(prefix);
};

const replyChain = async (message: Message<true>, limit: number) => {
	const chain: Message<true>[] = [];
	let current = message;
	while (chain.length < limit && current.reference?.messageId) {
		const parent = await current.fetchReference().catch(() => null);
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
	// people's messages sent after this one that it read
	later: string[];
}> => {
	const [
		{ historyLimit, laterLimit, threadLimit, maxImages, imageMaxAgeMs },
		{ prefix },
		{ answeringMarker, replyLabel },
	] = await Promise.all([
		getSettings(message.guildId, "chat"),
		getSettings(message.guildId, "commands"),
		getSettings(message.guildId, "personality"),
	]);

	const { messages: channelMessages } = message.channel;
	const [before, after, chain] = await Promise.all([
		channelMessages.fetch({ limit: historyLimit, before: message.id }),
		// anything sent while this reply waited its turn
		laterLimit > 0
			? channelMessages.fetch({ limit: laterLimit, after: message.id })
			: null,
		replyChain(message, threadLimit),
	]);
	const botId = message.client.user.id;

	const earlier = [...before.values()];
	const reset = earlier.findIndex((msg) => isReset(msg, botId));
	const recent = reset === -1 ? earlier : earlier.slice(0, reset);
	const resetAt = earlier[reset]?.createdTimestamp ?? 0;

	// the start of the conversation it's in, when that's older than the history
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

		// old discord attachment urls expire, and old images rarely matter anyway
		const fresh =
			message.createdTimestamp - msg.createdTimestamp <= imageMaxAgeMs;
		const images =
			msg.author.id === botId || !fresh
				? []
				: imagesOf(msg).slice(0, imageBudget);
		imageBudget -= images.length;

		if (!msg.cleanContent.trim() && images.length === 0) continue;
		if (!msg.author.bot) people.set(msg.author.id, nameOf(msg));
		kept.push({ msg, images });
	}

	// newer messages came in while it waited, so say which one it's answering
	const piledUp = kept[0]?.msg !== message;
	const speakerOf = (msg: Message<true>) => {
		const target = replyLabel && replyingTo(msg, byId, botId);
		return target
			? `${nameOf(msg)} ${replyLabel.replaceAll("{name}", target)}`
			: nameOf(msg);
	};
	const messages = kept
		.map(({ msg, images }) =>
			toModelMessage(
				msg,
				botId,
				images,
				speakerOf(msg),
				piledUp && msg === message ? answeringMarker : "",
			),
		)
		.reverse();

	// what people said, without name prefixes, so a chatter's own name doesn't count
	const human = kept.filter(({ msg }) => !msg.author.bot);
	const humanText = human.map(({ msg }) => msg.cleanContent).join("\n");
	const later = human
		.filter(({ msg }) => msg.createdTimestamp > message.createdTimestamp)
		.map(({ msg }) => msg.id);
	return { messages, people, humanText, later };
};
