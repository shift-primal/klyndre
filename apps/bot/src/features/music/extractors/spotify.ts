import { SpotifyExtractor } from "@discord-player/extractor";
import type { SearchQueryType } from "discord-player";
import { env } from "#/env";

const SPOTIFY_LINK = /^(https?:\/\/open\.spotify\.com\/|spotify:)/;
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export class CustomSpotifyExtractor extends SpotifyExtractor {
	override async validate(query: string, type?: SearchQueryType | null) {
		return SPOTIFY_LINK.test(query) && (await super.validate(query, type));
	}

	override async activate() {
		this.internal.requestToken = async () => {
			const id = env.DP_SPOTIFY_CLIENT_ID;
			const secret = env.DP_SPOTIFY_CLIENT_SECRET;
			if (!id || !secret) return null;

			try {
				const res = await fetch(SPOTIFY_TOKEN_URL, {
					method: "POST",
					headers: {
						Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: "grant_type=client_credentials",
				});
				const body = (await res.json()) as {
					access_token?: string;
					expires_in?: number;
				};
				if (!body.access_token) return null;

				this.internal.accessToken = {
					token: body.access_token,
					type: "Bearer",
					expiresAfter: Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000,
				};
				return this.internal.accessToken;
			} catch {
				return null;
			}
		};

		await super.activate();
	}
}
