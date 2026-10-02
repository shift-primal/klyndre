import { useSuspenseQuery } from "@tanstack/react-query";
import { guildsQuery } from "#/features/guilds/lib/guild-queries";

export const useGuilds = () => useSuspenseQuery(guildsQuery);
