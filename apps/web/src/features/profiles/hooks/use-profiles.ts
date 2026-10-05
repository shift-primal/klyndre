import { useSuspenseQuery } from "@tanstack/react-query";
import { profilesQuery } from "#/features/profiles/lib/profile-queries";

export const useProfiles = (guildId: string) =>
	useSuspenseQuery(profilesQuery(guildId));
