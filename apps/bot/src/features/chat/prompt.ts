import { getSettings } from "@klyndre/config";
import type { LoreEntry } from "@klyndre/db";
import type { Message } from "discord.js";
import type { SelectedLore } from "#/features/chat/lore";
import { loadNotes, type People } from "#/features/chat/profiles";

export interface PromptParts {
	persona: string;
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
};

export const chatContext = (message: Message<true>): ChatContext => ({
	guildId: message.guildId,
	botName: botNameOf(message),
	server: message.guild.name,
	channel: message.channel.name,
});

const buildParts = async (
	{ guildId, botName, server, channel }: ChatContext,
	people: People,
	lore: SelectedLore,
): Promise<PromptParts> => {
	const [
		{
			persona,
			rules,
			format,
			peopleGuidance,
			selfLoreGuidance,
			serverLoreGuidance,
		},
		{ timeZone, profilesEnabled },
	] = await Promise.all([
		getSettings(guildId, "personality"),
		getSettings(guildId, "chat"),
	]);
	const notes = profilesEnabled
		? await loadNotes(guildId, people)
		: new Map<string, string>();

	return {
		persona: persona || `You are ${botName}, a member of this Discord server.`,
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
			now: new Date().toLocaleDateString("en-GB", { timeZone }),
		},
	};
};

const section = (title: string, guidance: string, body: string) =>
	body && `## ${title}\n${[guidance, body].filter(Boolean).join("\n\n")}`;

const render = ({
	persona,
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
		rules,
		`## Context
You are ${context.botName} in the server "${context.server}", channel #${context.channel}.
Current time: ${context.now}.`,
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
