import type { Feature } from "#/core/feature";
import { withMusicChannel } from "#/features/music/access";
import { musicCommands } from "#/features/music/commands";

import { setupPlayer } from "#/features/music/player";

export const music: Feature = {
	name: "music",
	description: "Play music in a voice channel",
	commands: musicCommands.map(withMusicChannel),
	register: setupPlayer,
};
