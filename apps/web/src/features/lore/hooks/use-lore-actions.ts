import type { LoreKind } from "@klyndre/db/lore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "#/components/ui/toast";
import { loreQuery } from "#/features/lore/lib/lore-queries";
import {
	createLore,
	deleteLore,
	deleteUnlockedLore,
	updateLore,
} from "#/features/lore/server/lore.functions";

export type LoreFields = { key: string; notes: string; locked: boolean };

export const useLoreActions = (guildId: string) => {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: loreQuery(guildId).queryKey });
	const failed = (title: string) => (error: Error) =>
		toast.add({ type: "error", title, description: error.message });

	const create = useMutation({
		mutationFn: (input: LoreFields & { kind: LoreKind }) =>
			createLore({ data: { guildId, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Lore added" });
			return refresh();
		},
		onError: failed("Couldn't add lore"),
	});

	const update = useMutation({
		mutationFn: (input: LoreFields & { id: number }) =>
			updateLore({ data: { guildId, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Lore saved" });
			return refresh();
		},
		onError: failed("Couldn't save lore"),
	});

	const remove = useMutation({
		mutationFn: (id: number) => deleteLore({ data: { guildId, id } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Lore deleted" });
			return refresh();
		},
		onError: failed("Couldn't delete lore"),
	});

	const removeUnlocked = useMutation({
		mutationFn: (kind: LoreKind) =>
			deleteUnlockedLore({ data: { guildId, kind } }),
		onSuccess: (count) => {
			toast.add({ type: "success", title: `Deleted ${count} entries` });
			return refresh();
		},
		onError: failed("Couldn't delete lore"),
	});

	return { create, update, remove, removeUnlocked };
};
