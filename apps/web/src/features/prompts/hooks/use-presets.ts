import { useQuery } from "@tanstack/react-query";
import type { PromptKind } from "#/features/prompts/lib/prompt-kinds";
import { presetsQuery } from "#/features/prompts/lib/prompt-queries";

export const usePresets = (kind: PromptKind) => useQuery(presetsQuery(kind));
