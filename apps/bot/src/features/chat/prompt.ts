import { getSettings } from "@klyndre/config";
import type { LoreEntry } from "@klyndre/db";
import type { Message } from "discord.js";

import { describeCharacter, loadCharacter } from "#/features/chat/character";
import type { SelectedLore } from "#/features/chat/lore";
import { loadNotes, type People } from "#/features/chat/profiles";

interface PromptParts {
	persona: string;
	character: string;
	characterGuidance: string;
	rules: string;
	format: string;
	people: string;
	peopleGuidance: string;
	selfLore: string;
	selfLoreGuidance: string;
	serverLore: string;
	serverLoreGuidance: string;
	context: {
		botName: string;
		server: string;
		channel: string;
		now: string;
		language: string;
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

export const botNameOf = (message: Message<true>) =>
	message.guild.members.me?.displayName ?? message.client.user.username;

// where the reply goes, without discord, so scripts can build the same prompt
export type ChatContext = {
	guildId: string;
	botName: string;
	server: string;
	channel: string;
	// when it is for the bot, scripts set it to try other times of day
	now?: Date;
};

export const chatContext = (message: Message<true>): ChatContext => ({
	guildId: message.guildId,
	botName: botNameOf(message),
	server: message.guild.name,
	channel: message.channel.name,
});

// "Saturday 18 October 2026, 23:41", the weekday and hour matter as much as the date
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
): Promise<PromptParts> => {
	const [
		{
			persona,
			characterGuidance,
			rules,
			format,
			peopleGuidance,
			selfLoreGuidance,
			serverLoreGuidance,
		},
		{ timeZone, language, profilesEnabled },
		character,
	] = await Promise.all([
		getSettings(guildId, "personality"),
		getSettings(guildId, "chat"),
		loadCharacter(guildId, botName),
	]);
	const notes = profilesEnabled
		? await loadNotes(guildId, people)
		: new Map<string, string>();

	return {
		persona: persona || `You are ${botName}, a member of this Discord server.`,
		character: describeCharacter(character),
		characterGuidance,
		rules,
		format,
		people: describePeople(people, notes),
		// only worth saying when there are notes to go with it
		peopleGuidance: notes.size > 0 ? peopleGuidance : "",
		selfLore: describeLore(lore.self),
		selfLoreGuidance,
		serverLore: describeLore(lore.server),
		serverLoreGuidance,
		context: {
			botName,
			server,
			channel,
			now: describeTime(now, timeZone),
			language,
		},
	};
};

const section = (title: string, guidance: string, body: string) =>
	body && `## ${title}\n${[guidance, body].filter(Boolean).join("\n\n")}`;

const render = ({
	persona,
	character,
	characterGuidance,
	rules,
	format,
	people,
	peopleGuidance,
	selfLore,
	selfLoreGuidance,
	serverLore,
	serverLoreGuidance,
	context,
}: PromptParts) =>
	[
		persona,
		section("Who you are", characterGuidance, character),
		rules,
		[
			"## Context",
			`You are ${context.botName} in the server "${context.server}", channel #${context.channel}.`,
			`Current time: ${context.now}.`,
			context.language &&
				`You always write in ${context.language}, whatever language a message is in.`,
		]
			.filter(Boolean)
			.join("\n"),
		section("People in the chat", peopleGuidance, people),
		section("Your life", selfLoreGuidance, selfLore),
		section("Server lore", serverLoreGuidance, serverLore),
		format && `## Format\n${format}`,
	]
		.filter(Boolean)
		.join("\n\n");

export const buildInstructions = async (
	context: ChatContext,
	people: People,
	lore: SelectedLore,
) => render(await buildParts(context, people, lore));
