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

const buildParts = async (
	message: Message<true>,
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
		getSettings(message.guildId, "personality"),
		getSettings(message.guildId, "chat"),
	]);
	const notes = profilesEnabled
		? await loadNotes(message.guildId, people)
		: new Map<string, string>();
	const botName =
		message.guild.members.me?.displayName ?? message.client.user.username;

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
			server: message.guild.name,
			channel: message.channel.name,
			now: new Date().toLocaleDateString("en-GB", { timeZone }),
		},
	};
};

// left out entirely when there's nothing to list
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
	message: Message<true>,
	people: People,
	lore: SelectedLore,
) => render(await buildParts(message, people, lore));
