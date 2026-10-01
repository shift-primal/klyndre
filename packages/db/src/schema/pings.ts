import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const pings = pgTable("pings", {
	id: serial().primaryKey(),
	userId: text().notNull(),
	createdAt: timestamp().defaultNow().notNull(),
});
