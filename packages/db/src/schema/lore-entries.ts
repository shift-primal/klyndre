import { sql } from "drizzle-orm";
import {
	boolean,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import type { LoreKind } from "../lore";

export const loreEntries = pgTable(
	"lore_entries",
	{
		id: serial().primaryKey(),
		guildId: text().notNull(),
		kind: text().$type<LoreKind>().notNull(),
		key: text().notNull(),
		notes: text().notNull(),
		// written by hand, always in the prompt, and the bot never changes it
		locked: boolean().default(false).notNull(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("lore_entries_guild_kind_key").on(
			t.guildId,
			t.kind,
			sql`lower(${t.key})`,
		),
	],
);

export type LoreEntry = typeof loreEntries.$inferSelect;
