import { type APIGuild, DiscordAPIError, REST, Routes } from "discord.js";

import { createRegistry } from "#/core/commands/registry";
import { toSlashJSON } from "#/core/commands/slash";
import { deployEnv } from "#/env";
import { features } from "#/features";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DEV_GUILD_ID } = deployEnv();

const body = createRegistry(features).commands.map(toSlashJSON);

const rest = new REST().setToken(DISCORD_TOKEN);

// guild commands update right away, global ones can take a while
if (DEV_GUILD_ID) {
	try {
		await rest.put(
			Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEV_GUILD_ID),
			{ body },
		);
	} catch (error) {
		if (!(error instanceof DiscordAPIError && error.code === 50001))
			throw error;
		console.error(
			`The bot isn't in the dev server yet, invite it with https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=281749891434560&integration_type=0&scope=bot+applications.commands&guild_id=${DEV_GUILD_ID} and run this again`,
		);
		process.exit(1);
	}
	await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: [] });

	console.log(
		`Registered ${body.length} command(s) in the dev server, cleared global commands`,
	);
} else {
	await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body });

	const guilds = (await rest.get(Routes.userGuilds())) as APIGuild[];
	for (const guild of guilds) {
		await rest.put(
			Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guild.id),
			{ body: [] },
		);
	}

	console.log(
		`Registered ${body.length} global command(s), cleared guild commands in ${guilds.length} server(s)`,
	);
}
