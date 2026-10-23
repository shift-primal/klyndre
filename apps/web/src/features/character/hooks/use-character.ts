import { useSuspenseQuery } from "@tanstack/react-query";

import { characterQuery } from "#/features/character/lib/character-queries";

export const useCharacter = (guildId: string) =>
	useSuspenseQuery(characterQuery(guildId));
