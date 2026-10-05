import { queryOptions } from "@tanstack/react-query";
import { listProfiles } from "#/features/profiles/server/profiles.functions";

export const profilesQuery = (guildId: string) =>
	queryOptions({
		queryKey: ["guilds", guildId, "profiles"],
		queryFn: () => listProfiles({ data: { guildId } }),
	});

export type Profile = Awaited<ReturnType<typeof listProfiles>>[number];
