import { queryOptions } from "@tanstack/react-query";

import { getCharacter } from "#/features/character/server/character.functions";

export const characterQuery = (guildId: string) =>
	queryOptions({
		queryKey: ["guilds", guildId, "character"],
		queryFn: () => getCharacter({ data: { guildId } }),
	});

export type CharacterSection = Awaited<ReturnType<typeof getCharacter>>[number];
export type CharacterItem = CharacterSection["items"][number];
