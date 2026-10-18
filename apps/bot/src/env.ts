import { config } from "dotenv";
import { z } from "zod";

import { rootPath } from "#/lib/utils/fs";

config({ path: [rootPath(".env.local"), rootPath(".env")] });

const optional = <T extends z.ZodType>(schema: T) =>
	z.preprocess(
		(value) => (value === "" ? undefined : value),
		schema.optional(),
	);

const runtimeSchema = z.object({
	XAI_API_KEY: z.string().min(1),
	DISCORD_TOKEN: z.string().min(1),
	DEBUG_PLAYER: optional(z.stringbool()).default(false),
	DP_SPOTIFY_CLIENT_ID: optional(z.string()),
	DP_SPOTIFY_CLIENT_SECRET: optional(z.string()),
	DATABASE_URL: z.string().min(1),
	// a proxy on a home connection (http:// or socks5://) that YouTube lets
	// stream, unlike the server's datacenter IP. Unset or unreachable, YouTube
	// plays the slower way
	YOUTUBE_PROXY: optional(z.url()),
	// the one server a local dev bot runs in. Commands are registered there
	// instead of globally, and the bot won't start if it's in any other server
	DEV_GUILD_ID: optional(z.string()),
});

const deploySchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	DISCORD_CLIENT_ID: z.string().min(1),
	DEV_GUILD_ID: optional(z.string()),
});

export const env = runtimeSchema.parse(process.env);

export const deployEnv = () => deploySchema.parse(process.env);
