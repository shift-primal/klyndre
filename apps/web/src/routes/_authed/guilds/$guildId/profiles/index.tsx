import { createFileRoute } from "@tanstack/react-router";
import { ProfileList } from "#/features/profiles/components/profile-list";
import { profilesQuery } from "#/features/profiles/lib/profile-queries";

export const Route = createFileRoute("/_authed/guilds/$guildId/profiles/")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(profilesQuery(params.guildId)),
	component: ProfilesPage,
});

function ProfilesPage() {
	const { guildId } = Route.useParams();
	const { session } = Route.useRouteContext();

	return (
		<ProfileList guildId={guildId} readOnly={session.user.role !== "admin"} />
	);
}
