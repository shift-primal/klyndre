import { getSettings, type Settings } from "@klyndre/config";
import type { CharacterEntry, LoreEntry } from "@klyndre/db";
import type { Message } from "discord.js";

import { describeCharacter, loadSheet } from "#/features/chat/character";
import type { SelectedLore } from "#/features/chat/lore";
import { loadNotes, type People } from "#/features/chat/profiles";

interface PromptParts {
	persona: string;
	character: string;
	characterGuidance: string;
	behaviour: string;
	people: string;
	peopleGuidance: string;
	stories: string;
	storiesGuidance: string;
	serverLore: string;
	serverLoreGuidance: string;
	style: string;
	context: {
		botName: string;
		server: string;
		channel: string;
		now: string;
	};
}

const describePeople = (people: People, notes: Map<string, string>) =>
	[...people]
		.map(([id, name]) => {
			const note = notes.get(id);
			return note ? `- ${name}: ${note}` : `- ${name}`;
		})
		.join("\n");

const describeLore = (entries: LoreEntry[]) =>
	entries.map((entry) => `- ${entry.key}: ${entry.notes}`).join("\n");

const describeStories = (stories: CharacterEntry[]) =>
	stories.map((story) => `- ${story.text}`).join("\n");

const LENGTHS = {
	short: "Keep it short: often just a few words.",
	normal: "Keep it to a sentence or two.",
	long: "Write a few sentences when you have something to say, less when you don't.",
} as const;

const describeStyle = ({
	language,
	lowercaseReplies,
	stripEmojis,
	replyLength,
	styleNotes,
}: Settings<"style">) =>
	[
		`Chat messages are shown as "Name: text". Reply with only your message, no name prefix. No headings or bullet lists.`,
		language
			? `Always write in ${language}, whatever language a message is in.`
			: "Write in the language most of the chat is in, even when the last message is short or has an English word in it.",
		lowercaseReplies && "Write in all lowercase.",
		stripEmojis && "Never use emojis.",
		LENGTHS[replyLength],
		styleNotes.trim(),
	]
		.filter(Boolean)
		.join("\n");

export const botNameOf = (message: Message<true>) =>
	message.guild.members.me?.displayName ?? message.client.user.username;

export type ChatContext = {
	guildId: string;
	botName: string;
	server: string;
	channel: string;
	now?: Date;
};

export const chatContext = (message: Message<true>): ChatContext => ({
	guildId: message.guildId,
	botName: botNameOf(message),
	server: message.guild.name,
	channel: message.channel.name,
});

const describeTime = (date: Date, timeZone: string) =>
	date.toLocaleString("en-GB", {
		timeZone,
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

const buildParts = async (
	{ guildId, botName, server, channel, now = new Date() }: ChatContext,
	people: People,
	lore: SelectedLore,
	stories: CharacterEntry[],
): Promise<PromptParts> => {
	const [identity, internals, style, { timeZone }, { profilesEnabled }, sheet] =
		await Promise.all([
			getSettings(guildId, "identity"),
			getSettings(guildId, "internals"),
			getSettings(guildId, "style"),
			getSettings(guildId, "replies"),
			getSettings(guildId, "memory"),
			loadSheet(guildId),
		]);
	const notes = profilesEnabled
		? await loadNotes(guildId, people)
		: new Map<string, string>();

	return {
		persona:
			identity.persona ||
			`You are ${botName}, a member of this Discord server.`,
		character: describeCharacter(sheet, identity.quirksShown),
		characterGuidance: internals.characterGuidance,
		behaviour: identity.behaviour,
		people: describePeople(people, notes),
		peopleGuidance: notes.size > 0 ? internals.peopleGuidance : "",
		stories: describeStories(stories),
		storiesGuidance: internals.storiesGuidance,
		serverLore: describeLore(lore.server),
		serverLoreGuidance: internals.serverLoreGuidance,
		style: describeStyle(style),
		context: {
			botName,
			server,
			channel,
			now: describeTime(now, timeZone),
		},
	};
};

const section = (title: string, guidance: string, body: string) =>
	body && `## ${title}\n${[guidance, body].filter(Boolean).join("\n\n")}`;

const render = (
	{
		persona,
		character,
		characterGuidance,
		behaviour,
		people,
		peopleGuidance,
		stories,
		storiesGuidance,
		serverLore,
		serverLoreGuidance,
		style,
		context,
	}: PromptParts,
	withStyle: boolean,
) =>
	[
		persona,
		section("Who you are", characterGuidance, character),
		behaviour,
		[
			"## Context",
			`You are ${context.botName} in the server "${context.server}", channel #${context.channel}.`,
			`Current time: ${context.now}.`,
		].join("\n"),
		section("People in the chat", peopleGuidance, people),
		section("Stories you've told", storiesGuidance, stories),
		section("Server lore", serverLoreGuidance, serverLore),
		withStyle && section("Style", "", style),
	]
		.filter(Boolean)
		.join("\n\n");

export const buildInstructions = async (
	context: ChatContext,
	people: People,
	lore: SelectedLore,
	stories: CharacterEntry[],
	{ style = true }: { style?: boolean } = {},
) => render(await buildParts(context, people, lore, stories), style);
