import { setTimeout as sleep } from "node:timers/promises";

const MAX_WAIT_MS = 30_000;

const turns = new Map<string, Promise<void>>();

export function inTurn(channelId: string, task: () => Promise<void>) {
	const previous = turns.get(channelId);
	const wait = previous
		? Promise.race([previous, sleep(MAX_WAIT_MS)])
		: Promise.resolve();

	const next = wait
		.then(task)
		.catch((error) => console.error("[chat]", error))
		.finally(() => {
			if (turns.get(channelId) === next) turns.delete(channelId);
		});
	turns.set(channelId, next);
	return next;
}
