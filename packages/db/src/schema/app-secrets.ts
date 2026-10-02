import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// global secrets that change at runtime (cookies, tokens), not per guild
export const appSecrets = pgTable("app_secrets", {
	key: text().primaryKey(),
	value: text().notNull(),
	updatedAt: timestamp().defaultNow().notNull(),
});
