import { Client } from "pg";
import { cacheInvalidate } from "./cache";
import { CHANGE_CHANNEL } from "./index";
import { type ModuleName, moduleSchemas } from "./schemas";
import { SECRETS_CHANNEL, type SecretKey } from "./secrets";

const secretHandlers = new Map<SecretKey, Set<() => void | Promise<void>>>();

export function onSecretChange(
	key: SecretKey,
	handler: () => void | Promise<void>,
) {
	const handlers = secretHandlers.get(key) ?? new Set();
	handlers.add(handler);
	secretHandlers.set(key, handlers);
	return () => handlers.delete(handler);
}

export async function listenForSettingsChanges() {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	client.on("notification", (msg) => {
		if (!msg.payload) return;

		if (msg.channel === CHANGE_CHANNEL) {
			const { guildId, module } = JSON.parse(msg.payload) as {
				guildId: string;
				module: string;
			};
			if (module in moduleSchemas) {
				cacheInvalidate(guildId, module as ModuleName);
			}
		}

		if (msg.channel === SECRETS_CHANNEL) {
			const { key } = JSON.parse(msg.payload) as { key: SecretKey };
			for (const handler of secretHandlers.get(key) ?? []) {
				Promise.resolve(handler()).catch((error) =>
					console.error(`[secret ${key}]`, error),
				);
			}
		}
	});
	await client.query(`LISTEN ${CHANGE_CHANNEL}`);
	await client.query(`LISTEN ${SECRETS_CHANNEL}`);
	return () => client.end();
}
