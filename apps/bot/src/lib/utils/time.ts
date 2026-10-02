export function formatDuration(duration: string): string | null {
	const shortened = duration.replace(/^0(?=\d)/, "");
	return shortened === "0:00" ? null : shortened;
}
