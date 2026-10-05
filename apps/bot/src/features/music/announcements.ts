import { getSettings } from "@klyndre/config";
import type { Message } from "discord.js";
import {
	type GuildQueue,
	type Player,
	type Track,
	TrackSkipReason,
} from "discord-player";
import { createRetryTracker } from "#/features/music/retry";
import type { QueueMetadata } from "#/features/music/types";
import { controlButtons } from "#/features/music/ui/controls";
import { formatNowPlaying, formatTrack } from "#/features/music/ui/format";

const nowPlaying = new Map<string, Message>();
const retries = createRetryTracker();

const retryKey = (queue: GuildQueue, track: Track) =>
	`${queue.guild.id}:${track.id}`;

function textChannel(queue: GuildQueue) {
	const channel = (queue.metadata as QueueMetadata | null)?.channel;
	return channel && "send" in channel ? channel : null;
}

async function announce(queue: GuildQueue, content: string) {
	try {
		await textChannel(queue)?.send({ content, allowedMentions: { parse: [] } });
	} catch (error) {
		console.error("[announce]", error);
	}
}

async function retireNowPlaying(guildId: string, content?: string) {
	const message = nowPlaying.get(guildId);
	if (!message) return;
	nowPlaying.delete(guildId);

	try {
		await message.edit({ content, components: [] });
	} catch (error) {
		console.error("[announce]", error);
	}
}

function retryLater(queue: GuildQueue, track: Track) {
	setImmediate(() => {
		queue.insertTrack(track, 0);
		if (!queue.isPlaying()) void queue.node.play();
	});
}

export function registerAnnouncements(player: Player) {
	player.events.on("playerStart", async (queue, track) => {
		console.log(`[start] ${track.title}`);
		retries.clear(retryKey(queue, track));
		await retireNowPlaying(queue.guild.id);

		const channel = textChannel(queue);
		if (!channel) return;

		try {
			const message = await channel.send({
				content: formatNowPlaying(track),
				components: [controlButtons()],
				allowedMentions: { parse: [] },
			});
			nowPlaying.set(queue.guild.id, message);
		} catch (error) {
			console.error("[announce]", error);
		}

		console.log("[now playing]", {
			title: track.title,
			author: track.author,
			url: track.url,
			metadataSource: track.source,
			foundByExtractor: track.extractor?.identifier ?? "Unknown",
			rawSource: track.raw?.source ?? track.source,
		});
	});

	player.events.on("playerFinish", async (queue, track) => {
		console.log(`[finish] ${track.title}`);
		await retireNowPlaying(
			queue.guild.id,
			`✅ **Played:** ${formatTrack(track)}`,
		);
	});

	player.events.on("playerSkip", async (queue, track, reason) => {
		if (reason !== TrackSkipReason.NoStream) return;
		const { maxTrackRetries } = await getSettings(queue.guild.id, "music");

		if (retries.shouldRetry(retryKey(queue, track), maxTrackRetries)) {
			await announce(
				queue,
				`⚠️ Couldn't load ${formatTrack(track)}. Trying it again next.`,
			);
			retryLater(queue, track);
		} else {
			await announce(
				queue,
				`⚠️ Skipped ${formatTrack(track)}: the audio could not be loaded.`,
			);
		}
	});

	player.events.on("playerError", async (queue, error, track) => {
		console.error(`[player error] ${track.title}`, error);
		if ((error as { code?: string }).code === "ERR_NO_RESULT") return;
		await announce(queue, `⚠️ Playback problem with ${formatTrack(track)}.`);
	});

	player.events.on("emptyQueue", async (queue) => {
		const { leaveOnEnd, leaveOnEndMs } = await getSettings(
			queue.guild.id,
			"music",
		);
		const minutes = Math.round(leaveOnEndMs / 60_000);
		await announce(
			queue,
			leaveOnEnd
				? `✅ Queue finished. I'll leave in ${minutes} minutes if nothing else is queued.`
				: "✅ Queue finished.",
		);
	});

	player.events.on("emptyChannel", async (queue) => {
		await retireNowPlaying(queue.guild.id);
		await announce(queue, "👋 Left the voice channel because it was empty.");
	});

	player.events.on("disconnect", async (queue) => {
		await retireNowPlaying(queue.guild.id);
	});

	player.events.on("error", (_queue, error) => {
		console.error("[queue error]", error);
	});
}
