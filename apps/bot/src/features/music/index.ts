import type { Feature } from "#/core/feature";
import { withMusicChannel } from "#/features/music/access";
import { play } from "#/features/music/commands/play";
import { skip } from "#/features/music/commands/skip";
import { stop } from "#/features/music/commands/stop";
import { setupPlayer } from "#/features/music/player";

export const music: Feature = {
	name: "music",
	commands: [play, skip, stop].map(withMusicChannel),
	register: setupPlayer,
};
