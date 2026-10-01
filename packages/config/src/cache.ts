import type { ModuleName } from "./schemas";

const TTL_MS = 60_000;
const entries = new Map<string, { value: unknown; expires: number }>();

const key = (guildId: string, module: ModuleName) => `${guildId}:${module}`;

export const cacheGet = (guildId: string, module: ModuleName) => {
	const hit = entries.get(key(guildId, module));
	return hit && hit.expires > Date.now() ? hit : undefined;
};

export const cacheSet = (
	guildId: string,
	module: ModuleName,
	value: unknown,
) => {
	entries.set(key(guildId, module), { value, expires: Date.now() + TTL_MS });
};

export const cacheInvalidate = (guildId: string, module: ModuleName) => {
	entries.delete(key(guildId, module));
};
