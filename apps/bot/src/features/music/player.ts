import { DefaultExtractors, SpotifyExtractor } from "@discord-player/extractor";
import { onSecretChange } from "@klyndre/config/listen";
import type { Client } from "discord.js";
import { Player, useMainPlayer } from "discord-player";
import { YoutubeExtractor } from "discord-player-youtubei";
import { env } from "#/env";
import { registerAnnouncements } from "#/features/music/announcements";
import { CustomSpotifyExtractor } from "#/features/music/extractors/spotify";
import {
	loadCookies,
	youtubeOptions,
} from "#/features/music/extractors/youtube";

let cookies = "";

export async function setupPlayer(client: Client) {
	const player = new Player(client);
	cookies = await loadCookies();

	await player.extractors.register(CustomSpotifyExtractor, {});
	await player.extractors.register(YoutubeExtractor, youtubeOptions(cookies));
	await player.extractors.loadMulti(
		DefaultExtractors.filter((extractor) => extractor !== SpotifyExtractor),
	);

	registerAnnouncements(player);

	if (env.DEBUG_PLAYER) {
		player.events.on("debug", (_queue, message) =>
			console.log("[dbg]", message),
		);
		player.on("debug", (message) => console.log("[player dbg]", message));
	}

	// cookies are edited at runtime, so re-register the extractor when they change
	onSecretChange("youtube-cookies", reloadYoutubeCookies);
}

async function reloadYoutubeCookies() {
	const latest = await loadCookies();
	if (latest === cookies) return;
	cookies = latest;

	const { extractors } = useMainPlayer();
	await extractors.unregister(YoutubeExtractor.identifier);
	await extractors.register(YoutubeExtractor, youtubeOptions(cookies));
	console.log("[music] Reloaded the YouTube cookies");
}
