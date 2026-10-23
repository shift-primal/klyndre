import {
	CHARACTER_TEXT_MAX,
	characterEntries,
	characterField,
	characterFieldLocks,
	characterFieldNames,
	characterFields,
	db,
	withCharacterLock,
} from "@klyndre/db";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
	adminMiddleware,
	authMiddleware,
} from "#/features/auth/server/auth-middleware";
import { guildInput } from "#/features/guilds/lib/guild-input";
import { assertBotInGuild } from "#/features/guilds/server/discord.server";

const field = z.enum(characterFieldNames);
const itemFields = z.object({
	text: z.string().trim().min(1).max(CHARACTER_TEXT_MAX),
	locked: z.boolean(),
});
const itemInput = guildInput.extend({ id: z.int().positive() });

const byItem = (guildId: string, id: number) =>
	and(eq(characterEntries.guildId, guildId), eq(characterEntries.id, id));

export const getCharacter = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(guildInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		const [entries, locks] = await Promise.all([
			db
				.select({
					id: characterEntries.id,
					field: characterEntries.field,
					text: characterEntries.text,
					locked: characterEntries.locked,
					source: characterEntries.source,
				})
				.from(characterEntries)
				.where(eq(characterEntries.guildId, data.guildId))
				.orderBy(asc(characterEntries.createdAt), asc(characterEntries.id)),
			db
				.select()
				.from(characterFieldLocks)
				.where(eq(characterFieldLocks.guildId, data.guildId)),
		]);
		return characterFields.map((definition) => ({
			...definition,
			locked: locks.some(
				(lock) => lock.field === definition.field && lock.locked,
			),
			items: entries.filter((entry) => entry.field === definition.field),
		}));
	});

export const addCharacterEntry = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(guildInput.extend({ field }).extend(itemFields.shape))
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		const { cap } = characterField(data.field) ?? { cap: 0 };
		return withCharacterLock(data.guildId, async (tx) => {
			const items = await tx
				.select({ id: characterEntries.id })
				.from(characterEntries)
				.where(
					and(
						eq(characterEntries.guildId, data.guildId),
						eq(characterEntries.field, data.field),
					),
				);
			if (items.length >= cap) {
				throw new Error(`${data.field} is full (${cap})`);
			}
			const [entry] = await tx
				.insert(characterEntries)
				.values({ ...data, source: "manual" })
				.returning();
			return entry;
		});
	});

export const updateCharacterEntry = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(itemInput.extend(itemFields.shape))
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		return withCharacterLock(data.guildId, async (tx) => {
			const [current] = await tx
				.select()
				.from(characterEntries)
				.where(byItem(data.guildId, data.id));
			if (!current) throw new Error("That item no longer exists");

			const [entry] = await tx
				.update(characterEntries)
				.set({
					text: data.text,
					locked: data.locked,
					source: data.text === current.text ? current.source : "manual",
					updatedAt: new Date(),
				})
				.where(byItem(data.guildId, data.id))
				.returning();
			return entry;
		});
	});

export const deleteCharacterEntry = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(itemInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		const removed = await withCharacterLock(data.guildId, (tx) =>
			tx
				.delete(characterEntries)
				.where(byItem(data.guildId, data.id))
				.returning({ id: characterEntries.id }),
		);
		if (removed.length === 0) throw new Error("That item no longer exists");
	});

export const setCharacterFieldLocked = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(guildInput.extend({ field, locked: z.boolean() }))
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		await withCharacterLock(data.guildId, (tx) =>
			tx
				.insert(characterFieldLocks)
				.values(data)
				.onConflictDoUpdate({
					target: [characterFieldLocks.guildId, characterFieldLocks.field],
					set: { locked: data.locked, updatedAt: new Date() },
				}),
		);
	});
