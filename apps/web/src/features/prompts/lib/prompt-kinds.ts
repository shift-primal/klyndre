import { z } from "zod";

export const promptKinds = ["persona", "rules"] as const;
export type PromptKind = (typeof promptKinds)[number];

export const kindInput = z.object({ kind: z.enum(promptKinds) });
