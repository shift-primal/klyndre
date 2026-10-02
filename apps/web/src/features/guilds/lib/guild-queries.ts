import { queryOptions } from "@tanstack/react-query";
import {
	getGuildOptions,
	listGuilds,
} from "#/features/guilds/server/guilds.functions";

export const guildsQuery = queryOptions({
	queryKey: ["guilds"],
	queryFn: () => listGuilds(),
});

export const guildOptionsQuery = (guildId: string) =>
	queryOptions({
		queryKey: ["guilds", guildId, "options"],
		queryFn: () => getGuildOptions({ data: { guildId } }),
	});
