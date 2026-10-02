import { queryOptions } from "@tanstack/react-query";
import type { PromptKind } from "#/features/prompts/lib/prompt-kinds";
import { listPresets } from "#/features/prompts/server/prompts.functions";

export const presetsQuery = (kind: PromptKind) =>
	queryOptions({
		queryKey: ["prompts", kind],
		queryFn: () => listPresets({ data: { kind } }),
	});
