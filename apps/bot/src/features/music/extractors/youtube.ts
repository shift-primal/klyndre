import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSecret } from "@klyndre/config";
import type { YoutubeOptions } from "discord-player-youtubei";

const COOKIE_DOMAIN = /(^|\.)(youtube|google)\.com$/;
const COOKIE_COPY = join(tmpdir(), "yt-cookies.txt");

export const loadCookies = () => getSecret("youtube-cookies");

function cookieHeader(cookies: string) {
	const pairs: string[] = [];
	for (const raw of cookies.split("\n")) {
		const line = raw.replace(/^#HttpOnly_/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const [domain, , , , , name, value] = line.split("\t");
		if (domain && name && COOKIE_DOMAIN.test(domain.replace(/^\./, ""))) {
			pairs.push(`${name}=${value ?? ""}`);
		}
	}
	return pairs.join("; ");
}

export function youtubeOptions(cookies: string): YoutubeOptions {
	const hasCookies = Boolean(cookies.trim());
	if (hasCookies) {
		writeFileSync(COOKIE_COPY, cookies);
	} else {
		console.warn("No YouTube cookies set, playing YouTube without cookies");
	}

	return {
		cookie: hasCookies ? cookieHeader(cookies) : undefined,
		downloads: {
			// adaptive streams in-process (~1s to audio); yt-dlp spawns python per
			// track (~2.5s) and returns before it succeeds, so a failed run never
			// falls through. Keep it as the fallback.
			trialOrder: ["adaptive", "yt-dlp", "sabr"],
			ytdlp: { cookiePath: hasCookies ? COOKIE_COPY : undefined },
		},
	};
}
