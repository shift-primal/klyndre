import { env } from "node:process";
import { listenForSettingsChanges } from "@klyndre/config/listen";
import { db, pings } from "@klyndre/db";
import { Client, Events, GatewayIntentBits } from "discord.js";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.once(Events.ClientReady, (c) =>
	console.log(`Logged in as ${c.user.tag}`),
);

process.on("unhandledRejection", (error) => {
	console.error("[unhandled rejection]", error);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName === "ping") {
		await db.insert(pings).values({ userId: interaction.user.id });
		await interaction.reply("pong");
	}
});

const stopListening = await listenForSettingsChanges();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		console.log(`Received ${signal}, shutting down`);
		await client.destroy();
		await stopListening();
		process.exit(0);
	});
}

await client.login(env.DISCORD_TOKEN);
