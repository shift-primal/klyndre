import { useSuspenseQuery } from "@tanstack/react-query";
import { guildOptionsQuery } from "#/features/guilds/lib/guild-queries";

export const useGuildOptions = (guildId: string) =>
	useSuspenseQuery(guildOptionsQuery(guildId));
