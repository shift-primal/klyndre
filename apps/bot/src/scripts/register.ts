import { type APIGuild, REST, Routes } from "discord.js";
import { createRegistry } from "#/core/commands/registry";
import { toSlashJSON } from "#/core/commands/slash";
import { deployEnv } from "#/env";
import { features } from "#/features";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = deployEnv();

const body = createRegistry(features).commands.map(toSlashJSON);

const rest = new REST().setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body });

const guilds = (await rest.get(Routes.userGuilds())) as APIGuild[];
for (const guild of guilds) {
	await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guild.id), {
		body: [],
	});
}

console.log(
	`Registered ${body.length} global command(s), cleared guild commands in ${guilds.length} server(s)`,
);
