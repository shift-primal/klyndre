import { Client } from "pg";
import { cacheInvalidate } from "./cache";
import { CHANGE_CHANNEL } from "./index";
import { type ModuleName, moduleSchemas } from "./schemas";

export async function listenForSettingsChanges() {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	client.on("notification", (msg) => {
		if (msg.channel !== CHANGE_CHANNEL || !msg.payload) return;
		const { guildId, module } = JSON.parse(msg.payload) as {
			guildId: string;
			module: string;
		};
		if (module in moduleSchemas) cacheInvalidate(guildId, module as ModuleName);
	});
	await client.query(`LISTEN ${CHANGE_CHANNEL}`);
	return () => client.end();
}
