import type { Command } from "#/core/commands/types";
import { nowplaying } from "./nowplaying";
import { play } from "./play";
import { queue } from "./queue";
import { remove } from "./remove";
import { resume } from "./resume";
import { shuffle } from "./shuffle";
import { skip } from "./skip";
import { stop } from "./stop";

export const musicCommands: Command[] = [
	nowplaying,
	play,
	queue,
	remove,
	resume,
	shuffle,
	skip,
	stop,
];
