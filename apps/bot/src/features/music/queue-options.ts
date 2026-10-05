import type { Settings } from "@klyndre/config/schemas";

// fixed when a queue is created, so panel changes apply from the next queue
export const queueOptions = (settings: Settings<"music">) =>
	({
		disableVolume: true,
		disableEqualizer: true,
		disableFilterer: true,
		disableBiquad: true,
		disableResampler: true,
		disableCompressor: true,
		disableReverb: true,
		disableSeeker: true,
		disableFallbackStream: true,
		leaveOnEmpty: settings.leaveOnEmpty,
		leaveOnEmptyCooldown: settings.leaveOnEmptyMs,
		leaveOnEnd: settings.leaveOnEnd,
		leaveOnEndCooldown: settings.leaveOnEndMs,
		leaveOnStop: settings.leaveOnStop,
	}) as const;
