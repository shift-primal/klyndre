import {
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const guildSettings = pgTable(
	"guild_settings",
	{
		guildId: text().notNull(),
		module: text().notNull(), // "chat" | "music" | "core"
		config: jsonb().notNull().default({}),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.guildId, t.module] })],
);
