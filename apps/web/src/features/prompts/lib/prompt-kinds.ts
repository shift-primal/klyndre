import { z } from "zod";

export const promptKinds = [
	"persona",
	"rules",
	"format",
	"profileInstructions",
	"loreInstructions",
] as const;
export type PromptKind = (typeof promptKinds)[number];

// prompt settings outside this list have nowhere to save presets
export const isPromptKind = (key: string): key is PromptKind =>
	(promptKinds as readonly string[]).includes(key);

export const kindInput = z.object({ kind: z.enum(promptKinds) });
