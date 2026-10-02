import type { ModuleName } from "@klyndre/config/schemas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { guildSettingsQuery } from "#/features/settings/lib/settings-queries";

export const useGuildSettings = (guildId: string, module: ModuleName) =>
	useSuspenseQuery(guildSettingsQuery(guildId, module));
