import { type PerformanceEntry, PerformanceObserver } from "node:perf_hooks";
import { getSettings } from "@klyndre/config";
import type { Player } from "discord-player";

// voice sends a packet every 20ms on this thread; when it freezes, the missed
// packets go out in a burst afterwards and play back sped up

// how often the clock is checked, the shortest freeze it can measure
const TICK_MS = 50;

interface Freeze {
	from: number;
	to: number;
	stallMs: number;
	cpuMs: number;
}

function cause(freeze: Freeze, gcs: PerformanceEntry[]) {
	const gcMs = gcs
		.filter((gc) => gc.startTime >= freeze.from && gc.startTime < freeze.to)
		.reduce((total, gc) => total + gc.duration, 0);
	if (gcMs >= freeze.stallMs / 2) return "garbage collection";

	// busy: our own code held the thread. starved: the host gave us no cpu
	const windowMs = freeze.to - freeze.from;
	return freeze.cpuMs >= windowMs * 0.7 ? "busy" : "starved of cpu";
}

async function report(player: Player, stallMs: number, why: string) {
	const lines: string[] = [];
	for (const queue of player.queues.cache.values()) {
		if (!queue.isPlaying()) continue;
		const { lagLogMs } = await getSettings(queue.guild.id, "music");
		if (lagLogMs > 0 && stallMs >= lagLogMs) {
			lines.push(`${queue.guild.name}: ${queue.currentTrack?.title}`);
		}
	}
	if (lines.length === 0) return;

	console.warn(
		`[lag] froze ${Math.round(stallMs)}ms (${why}) while playing`,
		lines.join(", "),
	);
}

export function registerLagLog(player: Player) {
	let gcs: PerformanceEntry[] = [];
	new PerformanceObserver((list) => {
		gcs.push(...list.getEntries());
	}).observe({ entryTypes: ["gc"] });

	let last = performance.now();
	let lastCpu = process.cpuUsage();
	let pending: Freeze | undefined;

	setInterval(() => {
		// gc entries arrive after the tick that saw the freeze, so it is
		// reported one tick later. A settings read only fails when the db is
		// down, which is logged elsewhere
		if (pending) {
			const why = cause(pending, gcs);
			report(player, pending.stallMs, why).catch(() => {});
			pending = undefined;
		}

		const now = performance.now();
		const cpu = process.cpuUsage(lastCpu);
		const stallMs = now - last - TICK_MS;
		if (stallMs > 0) {
			const cpuMs = (cpu.user + cpu.system) / 1000;
			pending = { from: last, to: now, stallMs, cpuMs };
		}

		gcs = gcs.filter((gc) => gc.startTime >= last);
		last = now;
		lastCpu = process.cpuUsage();
	}, TICK_MS).unref();
}
