import { createFileRoute } from "@tanstack/react-router";
import { GuildList } from "#/features/guilds/components/guild-list";
import { guildsQuery } from "#/features/guilds/lib/guild-queries";

const Home = () => (
	<div>
		<p>home</p>
		<GuildList />
	</div>
);

export const Route = createFileRoute("/_authed/")({
	loader: ({ context }) => context.queryClient.ensureQueryData(guildsQuery),
	component: Home,
});
