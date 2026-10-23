import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appSecrets = pgTable("app_secrets", {
	key: text().primaryKey(),
	value: text().notNull(),
	updatedAt: timestamp().defaultNow().notNull(),
});
