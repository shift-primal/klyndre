import type { Command } from "#/core/commands/types";

import { hardReset } from "./hard-reset";
import { reset } from "./reset";

export const chatCommands: Command[] = [reset, hardReset];
