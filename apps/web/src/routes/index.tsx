import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getPingCount = createServerFn().handler(async () => {
	const { db, pings } = await import("@klyndre/db");
	return db.$count(pings);
});

export const Route = createFileRoute("/")({
	loader: () => getPingCount(),
	component: Home,
});

function Home() {
	const count = Route.useLoaderData();
	return <p>The bot has been pinged {count} times.</p>;
}
