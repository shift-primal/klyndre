import type { Command } from "#/core/commands/types";
import { help } from "#/features/general/commands/help";
import { ping } from "./ping";

export const generalCommands: Command[] = [ping, help];
