import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "#/components/ui/toast";
import type { PromptKind } from "#/features/prompts/lib/prompt-kinds";
import { presetsQuery } from "#/features/prompts/lib/prompt-queries";
import {
	deletePreset,
	savePreset,
} from "#/features/prompts/server/prompts.functions";

export const usePresetActions = (kind: PromptKind) => {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: presetsQuery(kind).queryKey });
	const failed = (title: string) => (error: Error) =>
		toast.add({ type: "error", title, description: error.message });

	const save = useMutation({
		mutationFn: (input: { name: string; content: string }) =>
			savePreset({ data: { kind, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Preset saved" });
			return refresh();
		},
		onError: failed("Couldn't save preset"),
	});

	const remove = useMutation({
		mutationFn: (id: number) => deletePreset({ data: { id } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Preset deleted" });
			return refresh();
		},
		onError: failed("Couldn't delete preset"),
	});

	return { save, remove };
};
