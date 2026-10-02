export function createRetryTracker() {
	const attempts = new Map<string, number>();

	return {
		shouldRetry(key: string, maxRetries: number): boolean {
			const used = attempts.get(key) ?? 0;
			if (used >= maxRetries) {
				attempts.delete(key);
				return false;
			}
			attempts.set(key, used + 1);
			return true;
		},
		clear(key: string) {
			attempts.delete(key);
		},
	};
}
