import {
	type GuildQueue,
	QueueRepeatMode,
	type Track,
	useMainPlayer,
} from "discord-player";

const SKIP_RESTORE_TIMEOUT_MS = 3000;

export function skipCurrent(queue: GuildQueue): boolean {
	return advance(queue, () => queue.node.skip());
}

export function skipToTrack(queue: GuildQueue, track: Track): boolean {
	return advance(queue, () => queue.node.skipTo(track));
}

function advance(queue: GuildQueue, action: () => boolean): boolean {
	if (queue.repeatMode !== QueueRepeatMode.TRACK) return action();

	const events = useMainPlayer().events;
	const restore = () => {
		clearTimeout(fallback);
		events.off("playerFinish", onFinish);
		queue.setRepeatMode(QueueRepeatMode.TRACK);
	};
	const onFinish = (finished: GuildQueue) => {
		if (finished.guild.id === queue.guild.id) setImmediate(restore);
	};
	const fallback = setTimeout(restore, SKIP_RESTORE_TIMEOUT_MS);

	queue.setRepeatMode(QueueRepeatMode.OFF);
	events.on("playerFinish", onFinish);

	const skipped = action();
	if (!skipped) restore();
	return skipped;
}
