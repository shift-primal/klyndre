import { createFileRoute } from "@tanstack/react-router";
import { LoreList } from "#/features/lore/components/lore-list";
import { loreQuery } from "#/features/lore/lib/lore-queries";

export const Route = createFileRoute("/_authed/guilds/$guildId/lore/")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(loreQuery(params.guildId)),
	component: LorePage,
});

function LorePage() {
	const { guildId } = Route.useParams();
	const { session } = Route.useRouteContext();

	return (
		<LoreList guildId={guildId} readOnly={session.user.role !== "admin"} />
	);
}
