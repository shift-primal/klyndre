// counters for each step of a call, logged every few seconds while they move,
// so a silent bot shows where the audio stopped: never arrived, failed to
// decrypt or decode, too quiet to count, or xAI never answered
export class VoiceStats {
	private readonly counts = new Map<string, number>();
	private readonly firstErrors = new Map<string, string>();
	private maxLevel = 0;
	private lastReport = "";

	count(key: string, by = 1) {
		this.counts.set(key, (this.counts.get(key) ?? 0) + by);
	}

	error(key: string, error: unknown) {
		this.count(key);
		if (!this.firstErrors.has(key)) {
			const message = error instanceof Error ? error.message : String(error);
			this.firstErrors.set(key, message);
			console.warn(`[voice] first ${key}: ${message}`);
		}
	}

	level(rms: number) {
		this.maxLevel = Math.max(this.maxLevel, Math.round(rms));
	}

	report(label: string) {
		if (this.counts.size === 0) return;
		const parts = [...this.counts].map(([key, n]) => `${key}=${n}`);
		parts.push(`loudest=${this.maxLevel}`);
		const line = parts.join(" ");
		if (line === this.lastReport) return;
		this.lastReport = line;
		console.log(`[voice] ${label}: ${line}`);
	}
}
