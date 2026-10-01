import { meta } from "./meta";

export const defaults = {
	chat: {
		model: meta("grok-4.20-non-reasoning", "xAI model used for replies"),
		aiChannelKeywords: meta(
			["bot", "chat"],
			"Channels whose name contains one of these get a reply to every message",
		),
		randomReplyChannelKeywords: meta(
			["general"],
			"Channels whose name contains one of these get a reply now and then",
		),
		randomReplyChance: meta(
			0.25,
			"Chance of butting in on a message in a random-reply channel without being tagged",
		),
		historyLimit: meta(25, "Chat messages read before each reply"),
		maxImages: meta(4, "Images sent to the model per reply"),
	},
	personality: {
		persona: meta("", "Who the bot is, top of the system prompt"),
		rules: meta("", "How it writes in chat, after the persona"),
	},
	commands: {
		prefix: meta("-", "Prefix for text commands"),
		devRole: meta("dev", "Role allowed to use the dev commands"),
	},
	music: {
		channelKeywords: meta(
			["bot", "music", "dj"],
			"Text commands only work in channels whose name contains at least one of these",
		),
		leaveOnEmptyMs: meta(60_000, "How long it stays in an empty voice channel"),
		leaveOnEndMs: meta(5 * 60_000, "How long it stays after the queue ends"),
		maxTrackRetries: meta(1, "Retries for a track that fails to play"),
		queuePageSize: meta(10, "Tracks per page in the queue view"),
	},
};
