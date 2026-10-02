import type { ModuleName } from "@klyndre/config/schemas";
import { queryOptions } from "@tanstack/react-query";
import { getGuildSettings } from "#/features/settings/server/settings.functions";

export const guildSettingsQuery = (guildId: string, module: ModuleName) =>
	queryOptions({
		queryKey: ["guilds", guildId, "settings", module],
		queryFn: () => getGuildSettings({ data: { guildId, module } }),
	});
