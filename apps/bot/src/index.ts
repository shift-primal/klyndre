import { listenForSettingsChanges } from "@klyndre/config/listen";
import { type Client, Events } from "discord.js";

import { createClient } from "#/core/client";
import { registerDispatch } from "#/core/commands/dispatch";
import { createRegistry } from "#/core/commands/registry";
import { env } from "#/env";
import { features } from "#/features";

const client = createClient();
const stopListening = await listenForSettingsChanges();

registerDispatch(client, createRegistry(features));
for (const feature of features) await feature.register?.(client);

const shutDown = async (code: number) => {
	await client.destroy();
	await stopListening();
	process.exit(code);
};

const checkDevGuilds = async (c: Client<true>) => {
	if (!env.DEV_GUILD_ID) return;
	const others = c.guilds.cache.filter((g) => g.id !== env.DEV_GUILD_ID);
	if (others.size === 0) return;

	console.error(
		`DEV_GUILD_ID is set, but ${c.user.tag} is also in ${others.map((g) => g.name).join(", ")}. Use a separate bot for development, or kick this one from those servers.`,
	);
	await shutDown(1);
};

client.once(Events.ClientReady, async (c) => {
	console.log(`Logged in as ${c.user.tag}${env.DEV_GUILD_ID ? " (dev)" : ""}`);
	await checkDevGuilds(c);
	if (env.DEV_GUILD_ID && !c.guilds.cache.has(env.DEV_GUILD_ID)) {
		console.warn(
			`Not in the dev server yet, invite it with https://discord.com/oauth2/authorize?client_id=${c.user.id}&permissions=281749891434560&integration_type=0&scope=bot+applications.commands&guild_id=${env.DEV_GUILD_ID}`,
		);
	}
});
client.on(Events.GuildCreate, (guild) => checkDevGuilds(guild.client));

process.on("unhandledRejection", (error) => {
	console.error("[unhandled rejection]", error);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		console.log(`Received ${signal}, shutting down`);
		await shutDown(0);
	});
}

await client.login(env.DISCORD_TOKEN);
