import {
	db,
	LORE_KEY_MAX,
	LORE_NOTES_MAX,
	loreEntries,
	loreKinds,
} from "@klyndre/db";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
	adminMiddleware,
	authMiddleware,
} from "#/features/auth/server/auth-middleware";
import { guildInput } from "#/features/guilds/lib/guild-input";
import { assertBotInGuild } from "#/features/guilds/server/discord.server";

const kind = z.enum(loreKinds);
const entryFields = z.object({
	key: z.string().trim().min(1).max(LORE_KEY_MAX),
	notes: z.string().trim().min(1).max(LORE_NOTES_MAX),
	locked: z.boolean(),
});
const entryInput = guildInput.extend({ id: z.int().positive() });

// every query by id also checks the guild, so an id from another server does nothing
const byEntry = (guildId: string, id: number) =>
	and(eq(loreEntries.guildId, guildId), eq(loreEntries.id, id));

// drizzle wraps the pg error, so the code can sit on the error or its cause
const isDuplicateKey = (error: unknown) =>
	[error, (error as { cause?: unknown })?.cause].some(
		(candidate) => (candidate as { code?: string })?.code === "23505",
	);

const duplicateKeyError = (error: unknown, key: string, kind: string) =>
	isDuplicateKey(error)
		? new Error(`"${key}" already exists in ${kind} lore`)
		: error;

export const listLore = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(guildInput)
	.handler(async ({ data }) => {
		await assertBotInGuild(data.guildId);
		return db
			.select()
			.from(loreEntries)
			.where(eq(loreEntries.guildId, data.guildId))
			.orderBy(asc(loreEntries.kind), asc(sql`lower(${loreEntries.key})`));
	});

export const createLore = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(guildInput.extend({ kind }).extend(entryFields.shape))
	.handler(async ({ data }) => {
		try {
			const [entry] = await db.insert(loreEntries).values(data).returning();
			return entry;
		} catch (error) {
			throw duplicateKeyError(error, data.key, data.kind);
		}
	});

export const updateLore = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(entryInput.extend(entryFields.shape))
	.handler(async ({ data }) => {
		const [current] = await db
			.select()
			.from(loreEntries)
			.where(byEntry(data.guildId, data.id));
		if (!current) throw new Error("That entry no longer exists");

		const { key, notes, locked } = data;
		if (
			key === current.key &&
			notes === current.notes &&
			locked === current.locked
		) {
			return current;
		}

		try {
			const [entry] = await db
				.update(loreEntries)
				.set({ key, notes, locked, updatedAt: new Date() })
				.where(byEntry(data.guildId, data.id))
				.returning();
			if (!entry) throw new Error("That entry no longer exists");
			return entry;
		} catch (error) {
			throw duplicateKeyError(error, key, current.kind);
		}
	});

export const deleteLore = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(entryInput)
	.handler(async ({ data }) => {
		await db.delete(loreEntries).where(byEntry(data.guildId, data.id));
	});

export const deleteUnlockedLore = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(guildInput.extend({ kind }))
	.handler(async ({ data }) => {
		const removed = await db
			.delete(loreEntries)
			.where(
				and(
					eq(loreEntries.guildId, data.guildId),
					eq(loreEntries.kind, data.kind),
					eq(loreEntries.locked, false),
				),
			)
			.returning({ id: loreEntries.id });
		return removed.length;
	});
