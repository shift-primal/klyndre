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
		imageMaxAgeMs: meta(
			15 * 60_000,
			"Images older than this (before the message being answered) are left out",
		),
		maxReplyTokens: meta(500, "Longest reply the model may write, in tokens"),
		singleLineReplies: meta(true, "Cut replies down to their first line"),
		lowercaseReplies: meta(true, "Send replies in all lowercase"),
		stripEmojis: meta(true, "Remove emojis from replies"),
		turnWaitLimitMs: meta(
			30_000,
			"How long a reply waits for the one before it in the same channel",
		),
		timeZone: meta(
			"Europe/Oslo",
			"Time zone for the date in the prompt (IANA name, like Europe/Oslo)",
		),
		profilesEnabled: meta(
			true,
			"Keep notes on people and show them to the model",
		),
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
		persona: meta(
			`You are a regular member of this Discord server, not an assistant.
You have your own opinions, moods and sense of humour, and you join in like anyone else would.`,
			"Who the bot is, top of the system prompt",
			"prompt",
		),
		rules: meta(
			`Match the tone and language of the chat. Have opinions, and disagree when you do.
Don't offer help unless asked, and don't end messages with questions just to keep things going.`,
			"How it writes in chat, after the persona",
			"prompt",
		),
		format: meta(
			`Chat messages are shown as "Name: text". Reply with only your message, no name prefix.
Write like a person in a Discord chat: one short line, all lowercase, no emojis, no headings or bullet lists.`,
			"How replies are laid out, at the end of the prompt",
			"prompt",
		),
		peopleGuidance: meta(
			`Background on the people here, from earlier chats. Use it to know who you're talking to, not as material.
Don't bring these things up unless the conversation is already about them, and don't turn them into running jokes.`,
			"How the model should use its notes on people, above the notes",
			"prompt",
		),
		profileInstructions: meta(
			`You keep short notes on the people in a Discord chat, so a chat bot can recognise them later.
Note lasting things about each person: interests, habits, opinions, how they write. Skip one-off topics, and skip jokes or reactions about what the bot said.
At most 30 words per person. Keep old notes that still hold. Only include people whose notes changed.`,
			"Instructions for the model that updates the notes on people",
			"prompt",
		),
		fallbackReply: meta(
			"brain lagged, try again",
			"Sent when the model errors or writes nothing (empty to stay quiet)",
		),
		contentFilterReply: meta(
			"Nah, can't help with that one.",
			"Sent when the model refuses (empty to stay quiet)",
		),
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
		leaveOnEmpty: meta(
			true,
			"Leave the voice channel when everyone else has left",
		),
		leaveOnEmptyMs: meta(60_000, "How long it stays in an empty voice channel"),
		leaveOnEnd: meta(true, "Leave the voice channel when the queue ends"),
		leaveOnEndMs: meta(5 * 60_000, "How long it stays after the queue ends"),
		leaveOnStop: meta(true, "Leave the voice channel right away on stop"),
		restoreWindowMs: meta(
			30 * 60_000,
			"How long a stopped queue can be brought back with restore",
		),
		maxTrackRetries: meta(1, "Retries for a track that fails to play"),
		queuePageSize: meta(10, "Tracks per page in the queue view"),
	},
};
