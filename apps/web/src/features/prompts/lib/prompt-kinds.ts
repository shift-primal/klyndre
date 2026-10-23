import { z } from "zod";

export const promptKinds = ["persona"] as const;
export type PromptKind = (typeof promptKinds)[number];

export const isPromptKind = (key: string): key is PromptKind =>
	(promptKinds as readonly string[]).includes(key);

export const kindInput = z.object({ kind: z.enum(promptKinds) });
