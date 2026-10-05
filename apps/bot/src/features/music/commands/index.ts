import type { Command } from "#/core/commands/types";
import { playNext } from "#/features/music/commands/play-next";
import { playNow } from "#/features/music/commands/play-now";
import { skipTo } from "#/features/music/commands/skip-to";
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
	playNext,
	playNow,
	queue,
	remove,
	resume,
	shuffle,
	skip,
	skipTo,
	stop,
];
