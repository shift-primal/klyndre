import type { Track } from "discord-player";

export function findTrack(tracks: Track[], input: string): Track | undefined {
	const query = input.trim().toLowerCase();

	const byId = tracks.find((track) => track.id === input.trim());
	if (byId) return byId;

	if (/^\d+$/.test(query)) {
		const byPosition = tracks[Number(query) - 1];
		if (byPosition) return byPosition;
	}

	const title = (track: Track) => track.title.toLowerCase();
	const full = (track: Track) => `${track.author} ${track.title}`.toLowerCase();

	return (
		tracks.find((track) => title(track) === query) ??
		tracks.find((track) => title(track).startsWith(query)) ??
		tracks.find((track) => full(track).includes(query))
	);
}
