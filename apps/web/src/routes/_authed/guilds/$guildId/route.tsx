import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { guildsQuery } from "#/features/guilds/lib/guild-queries";

export const Route = createFileRoute("/_authed/guilds/$guildId")({
	loader: async ({ context, params }) => {
		const guilds = await context.queryClient.ensureQueryData(guildsQuery);
		const guild = guilds.find((candidate) => candidate.id === params.guildId);
		if (!guild) throw redirect({ to: "/" });
		return guild;
	},
	component: GuildLayout,
});

function GuildLayout() {
	const guild = Route.useLoaderData();

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<Link to="/" className="text-sm text-muted-foreground hover:underline">
					← Servers
				</Link>
				<h1 className="text-2xl font-semibold">{guild.name}</h1>
			</div>
			<Outlet />
		</div>
	);
}
