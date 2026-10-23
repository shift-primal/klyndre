import { sql } from "drizzle-orm";
import {
	boolean,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const loreEntries = pgTable(
	"lore_entries",
	{
		id: serial().primaryKey(),
		guildId: text().notNull(),
		key: text().notNull(),
		notes: text().notNull(),
		locked: boolean().default(false).notNull(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("lore_entries_guild_key").on(t.guildId, sql`lower(${t.key})`),
	],
);

export type LoreEntry = typeof loreEntries.$inferSelect;
