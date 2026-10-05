import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";
import { loadNotes, type People } from "#/features/chat/profiles";

export interface PromptParts {
	persona: string;
	rules: string;
	format: string;
	people: string;
	peopleGuidance: string;
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

const buildParts = async (
	message: Message<true>,
	people: People,
): Promise<PromptParts> => {
	const [
		{ persona, rules, format, peopleGuidance },
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
		context: {
			botName,
			server: message.guild.name,
			channel: message.channel.name,
			now: new Date().toLocaleDateString("en-GB", { timeZone }),
		},
	};
};

const render = ({
	persona,
	rules,
	format,
	people,
	peopleGuidance,
	context,
}: PromptParts) =>
	[
		persona,
		rules,
		`## Context
You are ${context.botName} in the server "${context.server}", channel #${context.channel}.
Current time: ${context.now}.`,
		people &&
			`## People in the chat\n${[peopleGuidance, people].filter(Boolean).join("\n\n")}`,
		format && `## Format\n${format}`,
	]
		.filter(Boolean)
		.join("\n\n");

export const buildInstructions = async (
	message: Message<true>,
	people: People,
) => render(await buildParts(message, people));
