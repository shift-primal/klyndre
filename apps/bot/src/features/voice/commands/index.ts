import type { Command } from "#/core/commands/types";

import { hangup } from "./hangup";
import { talk } from "./talk";

export const voiceCommands: Command[] = [talk, hangup];
