import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable(
	"profiles",
	{
		guildId: text().notNull(),
		userId: text().notNull(),
		name: text().notNull(),
		notes: text().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);
