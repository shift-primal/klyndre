import type { Track } from "discord-player";

// how close a search result is to what was asked for. Spotify answers every
// search with something, even a song that only exists on YouTube, so a result
// has to contain most of the words typed before it's trusted

// share of the typed words a result needs to count as a match
const MATCH = 0.75;

// words people add to a search that the song itself doesn't have
const FILLER = new Set([
	"official",
	"audio",
	"video",
	"music",
	"lyrics",
	"lyric",
	"hd",
	"hq",
	"by",
	"the",
	"ft",
	"feat",
	"featuring",
	"and",
	"x",
]);

// other takes on a song, which only fit when they were asked for
const VERSIONS = [
	"live",
	"cover",
	"remix",
	"sped up",
	"speed up",
	"slowed",
	"nightcore",
	"karaoke",
	"instrumental",
	"acoustic",
	"8d",
	"reverb",
	"bass boosted",
	"extended",
	"mashup",
	"reaction",
	"tutorial",
	"lesson",
	"concert",
	"1 hour",
	"10 hours",
];

// a music video often has an intro, a skit or an outro around the song
const MUSIC_VIDEO = /\b(official (music )?video|music video|video ?clip|mv)\b/;

const LETTERS: Record<string, string> = {
	ø: "o",
	æ: "ae",
	ß: "ss",
	ł: "l",
	đ: "d",
};

export function normalize(text: string) {
	return (
		text
			.toLowerCase()
			.normalize("NFKD")
			.replace(/\p{M}/gu, "")
			.replace(/[øæßłđ]/g, (letter) => LETTERS[letter] ?? letter)
			.replace(/['’]/g, "")
			.replace(/&/g, " and ")
			.match(/[\p{L}\p{N}]+/gu)
			?.join(" ") ?? ""
	);
}

const words = (text: string) => normalize(text).split(" ").filter(Boolean);

// one typo per word, two in long ones, so "weeknd" still finds "weekend"
function closeTo(word: string, other: string) {
	const allowed = word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
	if (allowed === 0 || Math.abs(word.length - other.length) > allowed) {
		return false;
	}
	let previous = Array.from({ length: other.length + 1 }, (_, i) => i);
	for (let i = 1; i <= word.length; i++) {
		const row = [i];
		for (let j = 1; j <= other.length; j++) {
			const swap = word[i - 1] === other[j - 1] ? 0 : 1;
			row[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(row[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + swap,
			);
		}
		previous = row;
	}
	return (previous[other.length] ?? Infinity) <= allowed;
}

// share of the wanted words found in the text. Numbers (a year, a part 2)
// count for half, and a word glued together ("acdc") still finds "ac dc"
export function coverage(wanted: string, text: string) {
	const needed = words(wanted).filter((word) => !FILLER.has(word));
	if (needed.length === 0) return 1;
	const have = words(text);
	const glued = have.join("");

	let total = 0;
	let found = 0;
	for (const word of needed) {
		const weight = /^\d+$/.test(word) ? 0.5 : 1;
		total += weight;
		if (
			have.includes(word) ||
			have.some((other) => closeTo(word, other)) ||
			(word.length >= 4 && glued.includes(word))
		) {
			found += weight;
		}
	}
	return found / total;
}

const has = (text: string, phrase: string) =>
	` ${normalize(text)} `.includes(` ${phrase} `);

// a live, remix, sped up... take the request didn't ask for
export function otherVersion(wanted: string, title: string) {
	return VERSIONS.some(
		(version) => has(title, version) && !has(wanted, version),
	);
}

export function isMusicVideo(wanted: string, title: string) {
	return (
		MUSIC_VIDEO.test(normalize(title)) && !MUSIC_VIDEO.test(normalize(wanted))
	);
}

export const isCloseMatch = (query: string, track: Track) =>
	coverage(query, `${track.author} ${track.title}`) >= MATCH;

// close matches first, then close matches in another version or as a music
// video, then the rest. Within each, the source's own order (its popularity)
// is kept
export function rankResults(query: string, tracks: Track[]) {
	const tier = (track: Track) => {
		if (!isCloseMatch(query, track)) return 2;
		return otherVersion(query, track.title) || isMusicVideo(query, track.title)
			? 1
			: 0;
	};
	return tracks
		.map((track) => ({ track, tier: tier(track) }))
		.sort((a, b) => a.tier - b.tier)
		.map(({ track }) => track);
}

// the parts of a Spotify title YouTube uploads leave out: "Song - Remastered
// 2011", "Song (feat. Someone)"
function bareTitle(title: string) {
	return (
		title
			.split(" - ")[0]
			?.replace(/[([](feat|ft|with)\b[^)\]]*[)\]]/gi, "")
			.trim() || title
	);
}

const seconds = (ms: number) => Math.round(ms / 1000);

// how well a YouTube video stands in for a Spotify song. The length is the
// best tell: the same recording is within a few seconds, a music video with an
// intro or outro runs long
export function bridgeScore(song: Track, video: Track) {
	const wanted = `${song.author} ${song.title}`;
	const artist = song.author.split(",")[0] ?? song.author;

	let score = coverage(bareTitle(song.title), video.title);
	score += 0.5 * coverage(artist, `${video.author} ${video.title}`);
	// the artist's own upload over a lyrics channel's, YouTube Music's
	// "Artist - Topic" audio over both
	if (coverage(artist, video.author) >= MATCH) score += 0.2;
	if (video.author.endsWith(" - Topic")) score += 0.2;

	if (song.durationMS && video.durationMS) {
		const off = Math.abs(seconds(song.durationMS) - seconds(video.durationMS));
		const tooFar = Math.max(20, seconds(song.durationMS) * 0.15);
		if (off <= 5) score += 0.6;
		else if (off <= 12) score += 0.3;
		else if (off > tooFar) score -= 0.6;
	}

	if (otherVersion(wanted, video.title)) score -= 1;
	if (isMusicVideo(wanted, video.title)) score -= 0.2;
	return score;
}
