import type { Client } from "discord.js";
import type { Command } from "#/core/commands/types";

export interface Feature {
	name: string;
	commands?: Command[];
	register?(client: Client): void | Promise<void>;
}
