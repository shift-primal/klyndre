import { listenForSettingsChanges } from "@klyndre/config/listen";
import { Events } from "discord.js";
import { createClient } from "#/core/client";
import { registerDispatch } from "#/core/commands/dispatch";
import { createRegistry } from "#/core/commands/registry";
import { env } from "#/env";
import { features } from "#/features";

const client = createClient();
const stopListening = await listenForSettingsChanges();

registerDispatch(client, createRegistry(features));
for (const feature of features) await feature.register?.(client);

client.once(Events.ClientReady, (c) =>
	console.log(`Logged in as ${c.user.tag}`),
);

process.on("unhandledRejection", (error) => {
	console.error("[unhandled rejection]", error);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		console.log(`Received ${signal}, shutting down`);
		await client.destroy();
		await stopListening();
		process.exit(0);
	});
}

await client.login(env.DISCORD_TOKEN);
