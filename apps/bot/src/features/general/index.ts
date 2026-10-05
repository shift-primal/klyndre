import type { Feature } from "#/core/feature";
import { generalCommands } from "#/features/general/commands";

export const general: Feature = {
	name: "general",
	description: "Basic bot commands",
	commands: generalCommands,
};
