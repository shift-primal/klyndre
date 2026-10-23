import { createFileRoute } from "@tanstack/react-router";

import { CharacterSheet } from "#/features/character/components/character-sheet";
import { characterQuery } from "#/features/character/lib/character-queries";

export const Route = createFileRoute("/_authed/guilds/$guildId/character/")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(characterQuery(params.guildId)),
	component: CharacterPage,
});

function CharacterPage() {
	const { guildId } = Route.useParams();
	const { session } = Route.useRouteContext();

	return (
		<CharacterSheet
			guildId={guildId}
			readOnly={session.user.role !== "admin"}
		/>
	);
}
