import { getSettings, setSettings } from "@klyndre/config";
import { type ModuleName, moduleSchemas } from "@klyndre/config/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	adminMiddleware,
	authMiddleware,
} from "#/features/auth/server/auth-middleware";
import { guildInput } from "#/features/guilds/lib/guild-input";
import { assertBotInGuild } from "#/features/guilds/server/discord.server";

const moduleNames = Object.keys(moduleSchemas) as [ModuleName, ...ModuleName[]];

const moduleInput = guildInput.extend({ module: z.enum(moduleNames) });

export const getGuildSettings = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(moduleInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		return getSettings(data.guildId, data.module);
	});

export const saveGuildSettings = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(moduleInput.extend({ patch: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		return setSettings(data.guildId, data.module, data.patch);
	});
