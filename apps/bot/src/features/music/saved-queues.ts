import type {
	GuildQueue,
	Player,
	QueueRepeatMode,
	Track,
} from "discord-player";

interface SavedQueue {
	tracks: Track[];
	repeatMode: QueueRepeatMode;
	savedAt: number;
}

const saved = new Map<string, SavedQueue>();

// every way a queue ends (stop, the stop button, being kicked, an empty channel) goes through delete()
export function registerQueueSaving(player: Player) {
	player.events.on("queueDelete", (queue: GuildQueue) => {
		const tracks = [queue.currentTrack, ...queue.tracks.toArray()].filter(
			(track): track is Track => track !== null,
		);
		if (tracks.length === 0) return;
		saved.set(queue.guild.id, {
			tracks,
			repeatMode: queue.repeatMode,
			savedAt: Date.now(),
		});
	});
}

export function getSavedQueue(
	guildId: string,
	keepMs: number,
): SavedQueue | null {
	const entry = saved.get(guildId);
	if (!entry) return null;
	if (Date.now() - entry.savedAt > keepMs) {
		saved.delete(guildId);
		return null;
	}
	return entry;
}

export const forgetSavedQueue = (guildId: string) => saved.delete(guildId);
