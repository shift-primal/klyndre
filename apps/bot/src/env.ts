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
});

const deploySchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	DISCORD_CLIENT_ID: z.string().min(1),
});

export const env = runtimeSchema.parse(process.env);

export const deployEnv = () => deploySchema.parse(process.env);
