import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/features/auth/server/auth-middleware";
import { guildInput } from "../lib/guild-input";
import {
	assertBotInGuild,
	botGuilds,
	guildChannels,
	guildRoles,
} from "./discord.server";

export const listGuilds = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(() => botGuilds());

export const getGuildOptions = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(guildInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		const [channels, roles] = await Promise.all([
			guildChannels(data.guildId),
			guildRoles(data.guildId),
		]);
		return { channels, roles };
	});
