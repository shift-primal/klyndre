import { db, profiles } from "@klyndre/db";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	adminMiddleware,
	authMiddleware,
} from "#/features/auth/server/auth-middleware";
import { guildInput } from "#/features/guilds/lib/guild-input";
import { assertBotInGuild } from "#/features/guilds/server/discord.server";

const profileInput = guildInput.extend({
	userId: z.string().regex(/^\d{15,25}$/),
});

const byUser = (guildId: string, userId: string) =>
	and(eq(profiles.guildId, guildId), eq(profiles.userId, userId));

export const listProfiles = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(guildInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		return db
			.select()
			.from(profiles)
			.where(eq(profiles.guildId, data.guildId))
			.orderBy(asc(profiles.name));
	});

export const updateProfile = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(
		profileInput.extend({ notes: z.string().trim().min(1).max(2_000) }),
	)
	.handler(async ({ data }) => {
		const [profile] = await db
			.update(profiles)
			.set({ notes: data.notes, updatedAt: new Date() })
			.where(byUser(data.guildId, data.userId))
			.returning();
		if (!profile) throw new Error("That profile no longer exists");
		return profile;
	});

export const deleteProfile = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(profileInput)
	.handler(async ({ data }) => {
		await db.delete(profiles).where(byUser(data.guildId, data.userId));
	});

export const deleteAllProfiles = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(guildInput)
	.handler(async ({ data }) => {
		const removed = await db
			.delete(profiles)
			.where(eq(profiles.guildId, data.guildId))
			.returning({ userId: profiles.userId });
		return removed.length;
	});
