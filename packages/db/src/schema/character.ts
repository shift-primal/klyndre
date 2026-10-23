import {
	boolean,
	index,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import type { CharacterField, CharacterSource } from "../character";

export const characterEntries = pgTable(
	"character_entries",
	{
		id: serial().primaryKey(),
		guildId: text().notNull(),
		field: text().$type<CharacterField>().notNull(),
		text: text().notNull(),
		locked: boolean().default(false).notNull(),
		source: text().$type<CharacterSource>().notNull(),
		usedAt: timestamp(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [index("character_entries_guild_field").on(t.guildId, t.field)],
);

export const characterFieldLocks = pgTable(
	"character_fields",
	{
		guildId: text().notNull(),
		field: text().$type<CharacterField>().notNull(),
		locked: boolean().default(false).notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.guildId, t.field] })],
);

export type CharacterEntry = typeof characterEntries.$inferSelect;
