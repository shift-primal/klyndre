import { sql } from "drizzle-orm";

import { db } from "./client";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const withCharacterLock = <T>(
	guildId: string,
	write: (tx: Transaction) => Promise<T>,
) =>
	db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${`character:${guildId}`}))`,
		);
		return write(tx);
	});
