import type { Command } from "#/core/commands/types";
import type { Feature } from "#/core/feature";

export interface CommandRegistry {
	commands: Command[];
	find(name: string): Command | undefined;
}

export function createRegistry(features: Feature[]): CommandRegistry {
	const commands = features.flatMap((feature) => feature.commands ?? []);

	const byName = new Map<string, Command>();
	for (const command of commands) {
		for (const name of [command.name, ...(command.aliases ?? [])]) {
			if (byName.has(name)) throw new Error(`Duplicate command name "${name}"`);
			byName.set(name, command);
		}
	}

	return { commands, find: (name) => byName.get(name.toLowerCase()) };
}
