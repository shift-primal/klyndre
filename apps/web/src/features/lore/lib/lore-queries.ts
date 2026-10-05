import { queryOptions } from "@tanstack/react-query";
import { listLore } from "#/features/lore/server/lore.functions";

export const loreQuery = (guildId: string) =>
	queryOptions({
		queryKey: ["guilds", guildId, "lore"],
		queryFn: () => listLore({ data: { guildId } }),
	});

export type Lore = Awaited<ReturnType<typeof listLore>>[number];
