import type {
	ChannelOption,
	GuildSummary,
	RoleOption,
} from "#/features/guilds/lib/types";

const API = "https://discord.com/api/v10";
const GUILD_TEXT = 0;
const GUILD_ANNOUNCEMENT = 5;

type RawChannel = { id: string; name: string; type: number; position: number };
type RawRole = { id: string; name: string; color: number; position: number };

export class DiscordError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function asBot<T>(path: string) {
	const response = await fetch(`${API}${path}`, {
		headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
	});
	if (!response.ok) {
		throw new DiscordError(
			response.status,
			`Discord ${response.status} for ${path}`,
		);
	}
	return (await response.json()) as T;
}

const cache = new Map<string, { promise: Promise<unknown>; expires: number }>();

// caches the in-flight promise, so concurrent callers share one Discord request
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>) {
	const hit = cache.get(key);
	if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;
	const promise = load();
	cache.set(key, { promise, expires: Date.now() + ttlMs });
	promise.catch(() => {
		if (cache.get(key)?.promise === promise) cache.delete(key);
	});
	return promise;
}

export const botGuilds = () =>
	cached("bot-guilds", 60_000, async () => {
		const guilds: GuildSummary[] = [];
		let after: string | undefined;
		for (;;) {
			const page = await asBot<GuildSummary[]>(
				`/users/@me/guilds?limit=200${after ? `&after=${after}` : ""}`,
			);
			for (const { id, name, icon } of page) guilds.push({ id, name, icon });
			const last = page.at(-1);
			if (page.length < 200 || !last) return guilds;
			after = last.id;
		}
	});

export async function assertBotInGuild(guildId: string) {
	if (!(await botGuilds()).some((guild) => guild.id === guildId)) {
		throw new Error("The bot isn't in this server");
	}
}

export const guildChannels = (guildId: string) =>
	cached(`channels:${guildId}`, 15_000, async () => {
		const channels = await asBot<RawChannel[]>(`/guilds/${guildId}/channels`);
		return channels
			.filter((c) => c.type === GUILD_TEXT || c.type === GUILD_ANNOUNCEMENT)
			.sort((a, b) => a.position - b.position)
			.map(({ id, name }): ChannelOption => ({ id, name }));
	});

export const guildRoles = (guildId: string) =>
	cached(`roles:${guildId}`, 15_000, async () => {
		const roles = await asBot<RawRole[]>(`/guilds/${guildId}/roles`);
		return roles
			.filter((role) => role.id !== guildId) // @everyone
			.sort((a, b) => b.position - a.position)
			.map(({ id, name, color }): RoleOption => ({ id, name, color }));
	});
