import type { ModuleName } from "@klyndre/config/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "#/components/ui/toast";
import { guildSettingsQuery } from "#/features/settings/lib/settings-queries";
import { saveGuildSettings } from "#/features/settings/server/settings.functions";

export const useSaveSettings = (guildId: string, module: ModuleName) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (patch: Record<string, unknown>) =>
			saveGuildSettings({ data: { guildId, module, patch } }),
		onSuccess: (saved) => {
			queryClient.setQueryData(
				guildSettingsQuery(guildId, module).queryKey,
				saved,
			);
			toast.add({ type: "success", title: "Settings saved" });
		},
		onError: (error) => {
			toast.add({
				type: "error",
				title: "Couldn't save settings",
				description: error.message,
			});
		},
	});
};
