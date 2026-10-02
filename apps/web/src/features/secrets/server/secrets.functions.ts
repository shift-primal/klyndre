import { getSecretInfo, setSecret } from "@klyndre/config";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "#/features/auth/server/auth-middleware";

// only says whether the cookies exist, the value never leaves the server
export const getYoutubeCookieInfo = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(() => getSecretInfo("youtube-cookies"));

export const saveYoutubeCookies = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(z.object({ value: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		await setSecret("youtube-cookies", data.value);
		return getSecretInfo("youtube-cookies");
	});
