import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/features/auth/server/auth";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.handler(request),
			POST: ({ request }) => auth.handler(request),
		},
	},
});
