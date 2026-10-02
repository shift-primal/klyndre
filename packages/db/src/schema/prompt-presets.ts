import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const promptPresets = pgTable(
	"prompt_presets",
	{
		id: serial().primaryKey(),
		kind: text().notNull(), // "persona" | "rules"
		name: text().notNull(),
		content: text().notNull(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(t) => [unique().on(t.kind, t.name)],
);
