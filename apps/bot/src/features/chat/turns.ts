import { setTimeout as sleep } from "node:timers/promises";

const turns = new Map<string, Promise<void>>();

export function inTurn(
	channelId: string,
	maxWaitMs: number,
	task: () => Promise<void>,
) {
	const previous = turns.get(channelId);
	const wait = previous
		? Promise.race([previous, sleep(maxWaitMs)])
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
