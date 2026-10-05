import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";
import { loadNotes, type People } from "#/features/chat/profiles";

export interface PromptParts {
	persona: string;
	rules: string;
	people: string;
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
	const [{ persona, rules }, notes] = await Promise.all([
		getSettings(message.guildId, "personality"),
		loadNotes(message.guildId, people),
	]);
	const botName =
		message.guild.members.me?.displayName ?? message.client.user.username;

	return {
		persona: persona || `You are ${botName}, a member of this Discord server.`,
		rules,
		people: describePeople(people, notes),
		context: {
			botName,
			server: message.guild.name,
			channel: message.channel.name,
			now: new Date().toLocaleDateString("en-GB", { timeZone: "Europe/Oslo" }),
		},
	};
};

const FORMAT = `Chat messages are shown as "Name: text". Reply with only your message, no name prefix.
Write like a person in a Discord chat: short, casual, no headings or bullet lists unless asked.`;

const render = ({ persona, rules, people, context }: PromptParts) =>
	[
		persona,
		rules,
		`## Context
You are ${context.botName} in the server "${context.server}", channel #${context.channel}.
Current time: ${context.now}.`,
		people && `## People in the chat\n${people}`,
		`## Format\n${FORMAT}`,
	]
		.filter(Boolean)
		.join("\n\n");

export const buildInstructions = async (
	message: Message<true>,
	people: People,
) => render(await buildParts(message, people));
