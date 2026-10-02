import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Header } from "#/components/layout/header";
import { getSession } from "#/lib/auth.functions";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { session };
	},
	component: () => (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
			<Header />
			<Outlet />
		</div>
	),
});
