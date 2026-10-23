import type { CharacterField } from "@klyndre/db/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "#/components/ui/toast";
import { characterQuery } from "#/features/character/lib/character-queries";
import {
	addCharacterEntry,
	deleteCharacterEntry,
	setCharacterFieldLocked,
	updateCharacterEntry,
} from "#/features/character/server/character.functions";

export type ItemFields = { text: string; locked: boolean };

export const useCharacterActions = (guildId: string) => {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: characterQuery(guildId).queryKey,
		});
	const failed = (title: string) => (error: Error) =>
		toast.add({ type: "error", title, description: error.message });

	const add = useMutation({
		mutationFn: (input: ItemFields & { field: CharacterField }) =>
			addCharacterEntry({ data: { guildId, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Item added" });
			return refresh();
		},
		onError: failed("Couldn't add the item"),
	});

	const update = useMutation({
		mutationFn: (input: ItemFields & { id: number }) =>
			updateCharacterEntry({ data: { guildId, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Item saved" });
			return refresh();
		},
		onError: failed("Couldn't save the item"),
	});

	const remove = useMutation({
		mutationFn: (id: number) => deleteCharacterEntry({ data: { guildId, id } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Item deleted" });
			return refresh();
		},
		onError: failed("Couldn't delete the item"),
	});

	const lockField = useMutation({
		mutationFn: (input: { field: CharacterField; locked: boolean }) =>
			setCharacterFieldLocked({ data: { guildId, ...input } }),
		onSuccess: refresh,
		onError: failed("Couldn't change the lock"),
	});

	return { add, update, remove, lockField };
};
