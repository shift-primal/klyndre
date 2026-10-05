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
			<nav className="flex gap-4 border-b pb-2 text-sm">
				{(["settings", "profiles", "lore"] as const).map((page) => (
					<Link
						key={page}
						to={`/guilds/$guildId/${page}`}
						params={{ guildId: guild.id }}
						className="hover:text-foreground"
						inactiveProps={{ className: "text-muted-foreground" }}
						activeProps={{ className: "font-medium" }}
					>
						{page.charAt(0).toUpperCase() + page.slice(1)}
					</Link>
				))}
			</nav>
			<Outlet />
		</div>
	);
}
