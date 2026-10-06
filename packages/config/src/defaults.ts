import { meta } from "./meta";

export const defaults = {
	chat: {
		model: meta("grok-4.20-non-reasoning", "xAI model used for replies"),
		randomReplyChance: meta(
			0.25,
			"Chance of butting in on a message in a random-reply channel without being tagged",
		),
		historyLimit: meta(
			25,
			"Chat messages read from before the one it's answering",
		),
		laterLimit: meta(
			10,
			"Messages sent after the one it's answering, while it waited for its turn, that it still reads",
		),
		threadLimit: meta(
			12,
			"How far back it follows a chain of replies, past the chat history",
		),
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
		openerMemory: meta(
			5,
			"Its own recent replies it checks for repeated openers (0 to turn this off)",
		),
		openerRepeatLimit: meta(
			2,
			"Warn it when this many of its recent replies started with the same word, and try once more if it does it again (0 to never)",
		),
		skipMaxWords: meta(
			4,
			"Longest message (in words) it may stay quiet after, longer ones always get an answer. It also always answers right after asking something (0 to never stay quiet)",
		),
		loreEnabled: meta(
			true,
			"Keep lore (its own life and the server's running jokes) and show it to the model",
		),
		loreShown: meta(
			6,
			"Most lore entries matched to the chat that go in the prompt",
		),
		loreRandomFill: meta(
			0,
			"Random bits of its own life added to the prompt on top of the matched ones (0 for none)",
		),
		loreCooldownReplies: meta(
			10,
			"Replies before lore it brought up unprompted can show up unprompted again (0 for no cooldown)",
		),
		loreUpdateEvery: meta(5, "Replies in a channel between lore updates"),
		loreMaxEntries: meta(
			200,
			"Most unlocked lore entries per server. The stalest ones are removed past this",
		),
		loreMaxNewPerUpdate: meta(2, "Most new lore entries one update may add"),
		loreKeyWordLength: meta(
			3,
			"Shortest word in a lore key that counts when matching lore to the chat",
		),
		loreNoteWordLength: meta(
			5,
			"Shortest word in lore notes that counts when matching lore to the chat",
		),
		loreRareWordLimit: meta(
			3,
			"A word in lore notes only counts when fewer than this many entries' notes use it, so common words don't match everything",
		),
		loreEvidenceWords: meta(
			3,
			"Fewest words a lore update must quote from the chat to back it up (its own life has to be quoted from its own messages)",
		),
		loreUpdateContext: meta(
			20,
			"Lore entries the updater sees in full, most relevant first (it sees the rest by key only)",
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
		selfLoreGuidance: meta(
			`Facts about your own life, from earlier chats. Stay consistent with them, and you can make up new details that fit.
This is background, not material: don't bring it up unless someone asks or the chat is already about it, and don't repeat a detail you've already mentioned.`,
			"How the model should use its own life, above those entries",
			"prompt",
		),
		serverLoreGuidance: meta(
			`Running jokes and shared history in this server. Only reference them when the chat naturally touches them.
Never force a callback, and don't repeat one you've already made.`,
			"How the model should use server lore, above those entries",
			"prompt",
		),
		loreInstructions: meta(
			`You keep the lore for a chat bot in a Discord server. There are two kinds:
- self: the life the bot makes up for itself while chatting (friends, family, where it lives, its job, things it has done).
- server: things the group shares (running jokes, recurring topics, events, places). Never facts about one person; those are kept elsewhere.

The chat is a transcript, and the bot's own lines are marked (bot).
Save only lasting, new information. For self: only what the bot's own lines say about its own life. Not what it denies, not insults dressed up as answers, not nonsense it says to dodge a question. What other people say about their own lives is never self lore, even when the bot reacts to it; facts about people are kept elsewhere. For server: a joke or topic that keeps coming back, not a single remark.
For every entry, copy the words it's based on from the chat into evidence, exactly as written.
Skip anything already known, even when it's said again in other words. Never save an entry again just because it came up.

Use a name as the key when there is one, otherwise a short description ("the cousin"). Reuse existing keys exactly. When something listed under a description gets a name, save it under the name and set replaces to the old key. Write the full updated notes for every key you change, keeping what still holds, at most 40 words, in the chat's language.
Return only entries that are new or changed. If nothing is, return an empty list.`,
			"Instructions for the model that updates the lore",
			"prompt",
		),
		repeatedOpenerNote: meta(
			`your last replies keep starting with "{word}", don't start this one with it.`,
			"Note added after the last message when its recent replies keep starting with the same word ({word} is that word)",
			"textarea",
		),
		skipNote: meta(
			`if the chat is clearly over (it's just ok, sure or ye, or a goodbye you already answered), reply with only {marker}. if someone answers you or tells you something, reply normally.`,
			"Note added after the last message saying when it may stay quiet ({marker} is the skip marker). Only added when it wasn't tagged",
			"textarea",
		),
		skipMarker: meta(
			"[skip]",
			"What the model replies with to stay quiet, never sent (empty to always answer)",
		),
		fallbackReply: meta(
			"brain lagged, try again",
			"Sent when the model errors or writes nothing (empty to stay quiet)",
		),
		contentFilterReply: meta(
			"Nah, can't help with that one.",
			"Sent when the model refuses (empty to stay quiet)",
		),
		answeringMarker: meta(
			"← you're replying to this one",
			"Marks the message it's answering when newer ones came in while it waited (empty for no mark)",
		),
		replyLabel: meta(
			"(replying to {name})",
			'Goes after the name on a chat message that\'s a discord reply, so it knows who a message is aimed at ({name} is who it replies to, or "you" for the bot. Empty to leave it out)',
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
