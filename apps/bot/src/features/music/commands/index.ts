import type { Command } from "#/core/commands/types";
import { loop } from "./loop";
import { nowplaying } from "./nowplaying";
import { pause } from "./pause";
import { play } from "./play";
import { queue } from "./queue";
import { remove } from "./remove";
import { resume } from "./resume";
import { shuffle } from "./shuffle";
import { skip } from "./skip";
import { stop } from "./stop";

export const musicCommands: Command[] = [
	loop,
	nowplaying,
	pause,
	play,
	queue,
	remove,
	resume,
	shuffle,
	skip,
	stop,
];
