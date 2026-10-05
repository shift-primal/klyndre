import { getSettings } from "@klyndre/config";
import type { FilePart, ModelMessage } from "ai";
import type { Message } from "discord.js";

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

export const buildHistory = async (
	message: Message<true>,
): Promise<ModelMessage[]> => {
	const { historyLimit, maxImages } = await getSettings(
		message.guildId,
		"chat",
	);
	const fetched = await message.channel.messages.fetch({ limit: historyLimit });
	const botId = message.client.user.id;

	let imageBudget = maxImages;
	const history: ModelMessage[] = [];

	for (const msg of fetched.values()) {
		const images =
			msg.author.id === botId ? [] : imagesOf(msg).slice(0, imageBudget);
		imageBudget -= images.length;

		const modelMessage = toModelMessage(msg, botId, images);
		if (modelMessage) history.push(modelMessage);
	}
	return history.reverse();
};
