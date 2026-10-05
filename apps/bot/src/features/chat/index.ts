import { Events } from "discord.js";
import type { Feature } from "#/core/feature";
import { handleMessage } from "#/features/chat/handler";

export const chat: Feature = {
	name: "chat",
	register(client) {
		client.on(Events.MessageCreate, (m) => handleMessage(m));
	},
};
