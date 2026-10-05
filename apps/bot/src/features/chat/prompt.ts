import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";

export interface PromptParts {
	persona: string;
	rules: string;
	context: {
		botName: string;
		server: string;
		channel: string;
		now: string;
	};
}

const buildParts = async (message: Message<true>): Promise<PromptParts> => {
	const { persona, rules } = await getSettings(message.guildId, "personality");
	const botName =
		message.guild.members.me?.displayName ?? message.client.user.username;

	return {
		persona: persona || `You are ${botName}, a member of this Discord server.`,
		rules,
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

const render = ({ persona, rules, context }: PromptParts) =>
	[
		persona,
		rules,
		`## Context
You are ${context.botName} in the server "${context.server}", channel #${context.channel}.
Current time: ${context.now}.`,
		`## Format\n${FORMAT}`,
	]
		.filter(Boolean)
		.join("\n\n");

export const buildInstructions = async (message: Message<true>) =>
	render(await buildParts(message));
