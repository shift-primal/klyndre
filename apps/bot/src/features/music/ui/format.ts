import type { Playlist, Track } from "discord-player";
import { escapeLabel } from "#/lib/utils/text";
import { formatDuration } from "#/lib/utils/time";

function formatName(track: Track): string {
	const artist = track.author.replace(/ - Topic$/i, "").trim();
	const title = track.title.trim();

	if (!artist) return title;
	if (title.toLowerCase().startsWith(artist.toLowerCase())) return title;
	return `${artist} - ${title}`;
}

export function formatTrack(track: Track): string {
	const duration = formatDuration(track.duration);
	const label = duration
		? `${formatName(track)} - (${duration})`
		: formatName(track);

	return `[${escapeLabel(label)}](<${track.url}>)`;
}

export function formatPlaylist(playlist: Playlist): string {
	return `[${escapeLabel(playlist.title)}](<${playlist.url}>)`;
}

export function formatNowPlaying(track: Track): string {
	return `▶️ **Now playing:** ${formatTrack(track)}`;
}
