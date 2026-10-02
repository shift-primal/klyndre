import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "#/components/ui/header";

export const Route = createFileRoute("/_authed/")({
	component: () => (
		<div className=" mx-auto flex max-w-5xl flex-col gap-6 p-6">
			<Header />
			<Outlet />
		</div>
	),
});
