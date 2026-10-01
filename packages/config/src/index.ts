import { db, guildSettings } from "@klyndre/db";
import { and, eq, sql } from "drizzle-orm";
import { cacheGet, cacheSet } from "./cache";
import {
	type ModuleName,
	moduleSchemas,
	type Settings,
	type SettingsInput,
} from "./schemas";

export * from "./schemas";
export const CHANGE_CHANNEL = "settings_changed";

export async function getSettings<M extends ModuleName>(
	guildId: string,
	module: M,
): Promise<Settings<M>> {
	const cached = cacheGet(guildId, module);
	if (cached) return cached.value as Settings<M>;

	const [row] = await db
		.select({ config: guildSettings.config })
		.from(guildSettings)
		.where(
			and(eq(guildSettings.guildId, guildId), eq(guildSettings.module, module)),
		);

	const value = moduleSchemas[module].parse(row?.config ?? {}) as Settings<M>;
	cacheSet(guildId, module, value);
	return value;
}

export async function setSettings<M extends ModuleName>(
	guildId: string,
	module: M,
	patch: Partial<SettingsInput<M>>,
): Promise<Settings<M>> {
	const current = await getSettings(guildId, module);
	const next = moduleSchemas[module].parse({
		...current,
		...patch,
	}) as Settings<M>;

	await db
		.insert(guildSettings)
		.values({ guildId, module, config: next })
		.onConflictDoUpdate({
			target: [guildSettings.guildId, guildSettings.module],
			set: { config: next, updatedAt: new Date() },
		});

	// keep this process's cache current; the notify drops other processes' copies
	cacheSet(guildId, module, next);
	await db.execute(
		sql`select pg_notify(${CHANGE_CHANNEL}, ${JSON.stringify({ guildId, module })})`,
	);
	return next;
}
