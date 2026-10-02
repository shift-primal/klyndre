import { appSecrets, db } from "@klyndre/db";
import { eq, sql } from "drizzle-orm";

export const SECRETS_CHANNEL = "secrets_changed";

export type SecretKey = "youtube-cookies";

/** The stored value, or an empty string when the secret hasn't been set. */
export async function getSecret(key: SecretKey) {
	const [row] = await db
		.select({ value: appSecrets.value })
		.from(appSecrets)
		.where(eq(appSecrets.key, key));
	return row?.value ?? "";
}

/** Safe to show in a UI: says whether a secret exists, never what it is. */
export async function getSecretInfo(key: SecretKey) {
	const [row] = await db
		.select({ updatedAt: appSecrets.updatedAt })
		.from(appSecrets)
		.where(eq(appSecrets.key, key));
	return { isSet: Boolean(row), updatedAt: row?.updatedAt ?? null };
}

export async function setSecret(key: SecretKey, value: string) {
	await db
		.insert(appSecrets)
		.values({ key, value })
		.onConflictDoUpdate({
			target: appSecrets.key,
			set: { value, updatedAt: new Date() },
		});
	await db.execute(
		sql`select pg_notify(${SECRETS_CHANNEL}, ${JSON.stringify({ key })})`,
	);
}
