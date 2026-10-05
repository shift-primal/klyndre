import { Events } from "discord.js";
import type { Feature } from "#/core/feature";
import { chatCommands } from "#/features/chat/commands";
import { handleMessage } from "#/features/chat/handler";

export const chat: Feature = {
	name: "chat",
	commands: chatCommands,
	register(client) {
		client.on(Events.MessageCreate, (m) => handleMessage(m));
	},
};
