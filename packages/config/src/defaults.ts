import { advanced, meta } from "./meta";

export const defaults = {
	chat: {
		model: meta("grok-4.20-non-reasoning", "xAI model used for replies"),
		temperature: meta(
			0.9,
			"How random replies are, from 0 (safe and samey) to 2 (unhinged). Around 0.8 to 1 sounds most like a person",
		),
		randomReplyChance: meta(
			0.25,
			"Chance of butting in on a message in a random-reply channel without being tagged",
		),
		replyToMentionsAnywhere: meta(
			true,
			"Answer when tagged in any channel. Off, it only answers tags inside AI channels",
		),
		historyLimit: meta(
			25,
			"Chat messages read from before the one it's answering",
		),
		laterLimit: advanced(
			10,
			"Messages sent after the one it's answering, while it waited for its turn, that it still reads",
		),
		threadLimit: advanced(
			12,
			"How far back it follows a chain of replies, past the chat history",
		),
		maxImages: advanced(4, "Images sent to the model per reply"),
		imageMaxAgeMs: advanced(
			15 * 60_000,
			"Images older than this (before the message being answered) are left out",
		),
		maxReplyTokens: advanced(
			500,
			"Longest reply the model may write, in tokens",
		),
		maxMessages: meta(
			3,
			"Most messages one reply is sent as. Each line it writes is its own message, and lines past this are dropped (1 keeps only the first line)",
		),
		followUpTypingMs: advanced(
			45,
			"Typing time per character before each message after the first, so they don't all land at once (0 to send them right away)",
		),
		lowercaseReplies: meta(true, "Send replies in all lowercase"),
		stripEmojis: meta(true, "Remove emojis from replies"),
		turnWaitLimitMs: advanced(
			30_000,
			"How long a reply waits for the one before it in the same channel",
		),
		language: meta(
			"",
			"Language it always writes in, like Norwegian. Its character's slang is made up in it too. Empty to match the chat",
		),
		timeZone: advanced(
			"Europe/Oslo",
			"Time zone for the date and time in the prompt (IANA name, like Europe/Oslo)",
		),
		profilesEnabled: meta(
			true,
			"Keep notes on people and show them to the model",
		),
		profileUpdateEvery: advanced(
			15,
			"Replies in a channel between updates to its notes on people",
		),
		profileEvidenceWords: advanced(
			3,
			"Fewest words a new fact about someone must quote from their own messages, or their notes stay as they are",
		),
		openerMemory: advanced(
			5,
			"Its own recent replies it checks for repeated openers (0 to turn this off)",
		),
		openerRepeatLimit: advanced(
			2,
			"Warn it when this many of its recent replies started with the same word, and try once more if it does it again (0 to never)",
		),
		skipMaxWords: meta(
			4,
			"Longest message (in words) it may stay quiet after, longer ones always get an answer. It also always answers right after asking something (0 to never stay quiet)",
		),
		quietTypingMs: advanced(
			1_500,
			"When it could have stayed quiet, it only starts typing once it knows it's answering, and types this long before sending (0 to send right away)",
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
			1,
			"Random bits of its own life added to the prompt on top of the matched ones (0 for none)",
		),
		loreCooldownReplies: meta(
			10,
			"Replies before lore it brought up unprompted can show up unprompted again (0 for no cooldown)",
		),
		loreUpdateEvery: advanced(5, "Replies in a channel between lore updates"),
		loreMaxEntries: advanced(
			200,
			"Most unlocked lore entries per server. The stalest ones are removed past this",
		),
		loreMaxNewPerUpdate: advanced(
			2,
			"Most new lore entries one update may add",
		),
		loreKeyWordLength: advanced(
			3,
			"Shortest word in a lore key that counts when matching lore to the chat",
		),
		loreNoteWordLength: advanced(
			5,
			"Shortest word in lore notes that counts when matching lore to the chat",
		),
		loreRareWordLimit: advanced(
			3,
			"A word in lore notes only counts when fewer than this many entries' notes use it, so common words don't match everything",
		),
		loreEvidenceWords: advanced(
			3,
			"Fewest words a lore update must quote from the chat to back it up (its own life has to be quoted from its own messages)",
		),
		loreUpdateContext: advanced(
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
You have a life outside the server, your own opinions, moods and sense of humour, and you join in like anyone else would.`,
			"Who the bot is, top of the system prompt",
			"prompt",
		),
		rules: meta(
			`Match the tone and language of the chat. Have opinions, and disagree when you do.
Talk like a person, not a wiki. You don't know everything: say you have no idea, guess, or get things wrong now and then, and never explain things at length.
Bring your own life into it the way people do: what you did today, what something reminds you of, what you'd do. Your mood follows the time of day and where you are in your week.
Don't offer help unless asked, and don't end messages with questions just to keep things going.`,
			"How it writes in chat, after the persona",
			"prompt",
		),
		format: meta(
			`Chat messages are shown as "Name: text". Reply with only your message, no name prefix.
Write in the language most of the chat is in, even when the last message is short or has an english word in it.
Write like a person in a Discord chat: all lowercase, no emojis, no headings or bullet lists.
Keep it short: almost always one line, often just a few words. Only now and then, when you really have more to say, write two or three short lines instead; each line is sent as its own message.`,
			"How replies are laid out, at the end of the prompt",
			"prompt",
		),
		characterGuidance: meta(
			`This is who you are. Let it shape what you talk about, what you know and what you care about, and stay consistent with it.
Don't recite it or bring it all up at once; it comes out bit by bit, like with anyone.`,
			"How the model should use its character, above the character sheet",
			"prompt",
		),
		peopleGuidance: meta(
			`Background on the people here, from earlier chats. Use it to know who you're talking to, not as material.
Each note is about that one person only. Never apply it to anyone else, and never treat it as something that happened to you.
Don't bring these things up unless the conversation is already about them, and don't turn them into running jokes.`,
			"How the model should use its notes on people, above the notes",
			"prompt",
		),
		profileInstructions: advanced(
			`You keep short notes on the people in a Discord chat, so a chat bot can recognise them later.
The chat is a transcript: every line starts with who wrote it, and the bot's own lines are marked (bot).

Who a line is about:
- "I", "me" and "my" are whoever wrote that line.
- "you" and "your" in a line aimed at the bot are the bot, never the writer. "remember when your brother crashed the car" is about the bot's brother. The writer didn't crash anything, and neither did anyone they know.
- Questions, teasing, jokes and made-up stories are not facts.

What goes where:
- Notes (this job): lasting things a person says about themselves or their own family and friends, like their job, school, where they live, interests, habits, opinions and how they write.
- Lore (kept elsewhere, never in notes): the bot's own life, and things the whole group shares like running jokes and events.
What someone says about the bot, about another person in the chat or about the group is never a fact about them. Neither is anything the bot says about them.

For every new fact, copy the person's own words it comes from into quote, and say who it is about. Skip one-off topics and reactions to what the bot said.
When a note mentions someone else, name whose it is ("Sam's dad", never just "dad" or "his dad"). Never write notes as the bot's own memory ("remembers", "recalls").
Notes are at most 30 words per person and keep the old notes that still hold. Only include people with new facts about them.`,
			"Instructions for the model that updates the notes on people",
			"prompt",
		),
		selfLoreGuidance: meta(
			`Facts about your own life, from earlier chats. Stay consistent with them, and you can make up new details that fit.
Now and then, when it fits, bring one up like people do ("that reminds me…"), but never force it, and don't repeat a detail you've already mentioned.`,
			"How the model should use its own life, above those entries",
			"prompt",
		),
		serverLoreGuidance: meta(
			`Running jokes and shared history in this server. Only reference them when the chat naturally touches them.
Never force a callback, and don't repeat one you've already made.`,
			"How the model should use server lore, above those entries",
			"prompt",
		),
		loreInstructions: advanced(
			`You keep the lore for a chat bot in a Discord server. The chat is a transcript: every line starts with who wrote it, and the bot's own lines are marked (bot).

What goes where:
- self: the life the bot makes up for itself while chatting (friends, family, where it lives, its job, things it has done). Only from what the bot's own lines say about its own life.
- server: things the whole group shares: running jokes, recurring topics, events several people were part of, places. A joke or topic that keeps coming back, not a single remark.
- Facts about one person in the chat (their job, family, tastes, what they did) are kept elsewhere, as notes. Never save them as lore of either kind.

Who a line is about: "I", "me" and "my" are whoever wrote that line, and "you" and "your" in a line aimed at the bot are the bot. "remember when your brother crashed the car" is about the bot's brother: it's self lore only if the bot's own lines go along with it, and it's never something the writer did.
For self, skip what the bot denies, insults dressed up as answers and nonsense it says to dodge a question. What other people say about their own lives is never self lore, even when the bot reacts to it.

For every entry, copy the words it's based on from the chat into evidence, exactly as written.
Save only lasting, new information. Skip anything already known, even when it's said again in other words. Never save an entry again just because it came up.

Use a name as the key when there is one, otherwise a short description ("the cousin"). Reuse existing keys exactly. When something listed under a description gets a name, save it under the name and set replaces to the old key. Write the full updated notes for every key you change, keeping what still holds, at most 40 words, in the chat's language.
Return only entries that are new or changed. If nothing is, return an empty list.`,
			"Instructions for the model that updates the lore",
			"prompt",
		),
		repeatedOpenerNote: advanced(
			`your last replies keep starting with "{word}", don't start this one with it.`,
			"Note added after the last message when its recent replies keep starting with the same word ({word} is that word)",
			"textarea",
		),
		skipNote: advanced(
			`if the chat is clearly over (it's just ok, sure or ye, or a goodbye you already answered), reply with only {marker}. if someone answers you or tells you something, reply normally.`,
			"Note added after the last message saying when it may stay quiet ({marker} is the skip marker). Only added when it wasn't tagged",
			"textarea",
		),
		skipMarker: advanced(
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
		notHereReply: meta(
			"can't talk in here, find me in an ai channel",
			"Sent when it's tagged in a channel it doesn't talk in, with replies to tags anywhere off (empty to stay quiet)",
		),
		answeringMarker: advanced(
			"← you're replying to this one",
			"Marks the message it's answering when newer ones came in while it waited (empty for no mark)",
		),
		replyLabel: advanced(
			"(replying to {name})",
			'Goes after the name on a chat message that\'s a discord reply, so it knows who a message is aimed at ({name} is who it replies to, or "you" for the bot. Empty to leave it out)',
		),
	},
	// who the bot is, blank fields get made up and saved here the first time it chats
	character: {
		fillBlanks: meta(
			true,
			"Make up anything left blank the first time it chats, and save it here. Clear a field to have it made up again",
		),
		basics: meta("", "Age, gender, what they look like", "textarea"),
		home: meta(
			"",
			"Where they live, who with, and where they grew up",
			"textarea",
		),
		work: meta("", "Job or school, and what they think of it", "textarea"),
		family: meta([] as string[], "Family, with names", "list"),
		friends: meta(
			[] as string[],
			"Friends and love life outside this server, with names",
			"list",
		),
		routine: meta(
			"",
			"A normal week: when they work, sleep, train, game and go out",
			"textarea",
		),
		interests: meta(
			[] as string[],
			"Hobbies, and what they know a lot about",
			"list",
		),
		tastes: meta(
			[] as string[],
			"Favourite music, games, shows and food",
			"list",
		),
		opinions: meta(
			[] as string[],
			"Hot takes and things they'll argue about",
			"list",
		),
		dislikes: meta(
			[] as string[],
			"Pet peeves and things they can't stand",
			"list",
		),
		weaknesses: meta(
			[] as string[],
			"What they're bad at or know nothing about",
			"list",
		),
		quirks: meta([] as string[], "Habits, and things they say a lot", "list"),
		stories: meta(
			[] as string[],
			"Things that happened to them, stories they can tell",
			"list",
		),
		fillInstructions: advanced(
			`Make up a believable, ordinary person for a Discord bot called {name} to play in a group chat, so it has a life to talk about.
Fill in only the fields asked for, and stay consistent with the ones already filled in.
Be specific: real place names, a real job, names for family and friends, actual bands, games and dishes. Give them flaws and gaps, not just cool traits. Keep it everyday, like someone you'd actually know, not a quirky movie character.
People in the server are likely in the {timeZone} time zone, so they live somewhere that fits.
Quirks are what they do and say, not how they type; typing style is set elsewhere. Any slang or phrases they use are in {language}.
Write in English. Text fields are at most 40 words, list fields 2 to 4 short items.`,
			"Instructions for the model that makes up the blank fields ({name} is the bot's name, {timeZone} the chat time zone, {language} the chat language)",
			"prompt",
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
		restoreWindowMs: advanced(
			30 * 60_000,
			"How long a stopped queue can be brought back with restore",
		),
		maxTrackRetries: advanced(1, "Retries for a track that fails to play"),
		queuePageSize: advanced(10, "Tracks per page in the queue view"),
		lagLogMs: advanced(
			100,
			"Log to the bot console when it freezes this long while playing, which makes the music stutter (0 = off)",
		),
	},
};
