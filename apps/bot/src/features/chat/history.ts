import { getSettings } from "@klyndre/config";
import type { FilePart, ModelMessage } from "ai";
import type { Collection, Message } from "discord.js";
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

const toModelMessage = (
	msg: Message<true>,
	botId: string,
	images: FilePart[],
): ModelMessage | null => {
	const text = msg.cleanContent.trim();
	if (!text && images.length === 0) return null;

	if (msg.author.id === botId) return { role: "assistant", content: text };

	const line = `${nameOf(msg)}: ${text}`;
	if (images.length === 0) return { role: "user", content: line };

	return { role: "user", content: [{ type: "text", text: line }, ...images] };
};

const belongsInChat = (
	msg: Message<true>,
	fetched: Collection<string, Message<true>>,
	botId: string,
	prefix: string,
) => {
	if (msg.author.id !== botId) return !msg.content.startsWith(prefix);
	if (msg.interactionMetadata) return false;

	const answered = fetched.get(msg.reference?.messageId ?? "");
	return answered !== undefined && !answered.content.startsWith(prefix);
};

export const buildHistory = async (
	message: Message<true>,
): Promise<{ messages: ModelMessage[]; people: People }> => {
	const [{ historyLimit, maxImages }, { prefix }] = await Promise.all([
		getSettings(message.guildId, "chat"),
		getSettings(message.guildId, "commands"),
	]);

	const fetched = await message.channel.messages.fetch({ limit: historyLimit });
	const botId = message.client.user.id;

	let imageBudget = maxImages;
	const history: ModelMessage[] = [];

	const people: People = new Map();

	for (const msg of fetched.values()) {
		if (isReset(msg, botId)) break;
		if (!belongsInChat(msg, fetched, botId, prefix)) continue;
		if (!msg.author.bot) people.set(msg.author.id, nameOf(msg));

		const images =
			msg.author.id === botId ? [] : imagesOf(msg).slice(0, imageBudget);
		imageBudget -= images.length;

		const modelMessage = toModelMessage(msg, botId, images);
		if (modelMessage) history.push(modelMessage);
	}
	return { messages: history.reverse(), people };
};
