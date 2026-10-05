import { meta } from "./meta";

export const defaults = {
	chat: {
		model: meta("grok-4.20-non-reasoning", "xAI model used for replies"),
		randomReplyChance: meta(
			0.25,
			"Chance of butting in on a message in a random-reply channel without being tagged",
		),
		historyLimit: meta(25, "Chat messages read before each reply"),
		maxImages: meta(4, "Images sent to the model per reply"),
		profileUpdateEvery: meta(
			15,
			"Replies in a channel between updates to its notes on people",
		),
	},
	channels: {
		aiChannelIds: meta(
			[] as string[],
			"Channels where it replies to every message",
			"textChannel",
		),
		randomReplyChannelIds: meta(
			[] as string[],
			"Channels where it replies now and then",
			"textChannel",
		),
		musicChannelIds: meta(
			[] as string[],
			"Music commands only work in these channels",
			"textChannel",
		),
	},
	personality: {
		persona: meta("", "Who the bot is, top of the system prompt", "prompt"),
		rules: meta("", "How it writes in chat, after the persona", "prompt"),
	},
	commands: {
		prefix: meta("-", "Prefix for text commands"),
		devRoleId: meta(
			null as string | null,
			"Role allowed to use the dev commands",
			"role",
		),
	},
	music: {
		leaveOnEmptyMs: meta(60_000, "How long it stays in an empty voice channel"),
		leaveOnEndMs: meta(5 * 60_000, "How long it stays after the queue ends"),
		maxTrackRetries: meta(1, "Retries for a track that fails to play"),
		queuePageSize: meta(10, "Tracks per page in the queue view"),
	},
};
