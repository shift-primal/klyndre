import { type APIGuild, REST, Routes } from "discord.js";
import { commands } from "#/commands";
import { deployEnv } from "#/env";
import { toSlashJSON } from "#/lib/utils/slash";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = deployEnv();

const body = commands.map(toSlashJSON);

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
