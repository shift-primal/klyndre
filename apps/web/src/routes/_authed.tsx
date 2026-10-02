import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { Header } from "#/components/layout/header";
import { getSession } from "#/features/auth/server/auth.functions";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	const { session } = Route.useRouteContext();

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
			<div className="flex items-center justify-between">
				<Link to="/">Home</Link>
				<div className="flex items-center gap-4">
					{session.user.role === "admin" && <Link to="/secrets">Secrets</Link>}
					<Header />
				</div>
			</div>
			<Outlet />
		</div>
	);
}
