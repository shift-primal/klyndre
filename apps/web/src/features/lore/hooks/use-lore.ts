import { useSuspenseQuery } from "@tanstack/react-query";
import { loreQuery } from "#/features/lore/lib/lore-queries";

export const useLore = (guildId: string) =>
	useSuspenseQuery(loreQuery(guildId));
