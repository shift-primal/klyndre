import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "#/components/ui/toast";
import { profilesQuery } from "#/features/profiles/lib/profile-queries";
import {
	deleteAllProfiles,
	deleteProfile,
	updateProfile,
} from "#/features/profiles/server/profiles.functions";

export const useProfileActions = (guildId: string) => {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: profilesQuery(guildId).queryKey,
		});
	const failed = (title: string) => (error: Error) =>
		toast.add({ type: "error", title, description: error.message });

	const update = useMutation({
		mutationFn: (input: { userId: string; notes: string }) =>
			updateProfile({ data: { guildId, ...input } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Notes saved" });
			return refresh();
		},
		onError: failed("Couldn't save notes"),
	});

	const remove = useMutation({
		mutationFn: (userId: string) =>
			deleteProfile({ data: { guildId, userId } }),
		onSuccess: () => {
			toast.add({ type: "success", title: "Profile deleted" });
			return refresh();
		},
		onError: failed("Couldn't delete profile"),
	});

	const removeAll = useMutation({
		mutationFn: () => deleteAllProfiles({ data: { guildId } }),
		onSuccess: (count) => {
			toast.add({ type: "success", title: `Deleted ${count} profiles` });
			return refresh();
		},
		onError: failed("Couldn't delete profiles"),
	});

	return { update, remove, removeAll };
};
