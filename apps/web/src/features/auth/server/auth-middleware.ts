import { createMiddleware } from "@tanstack/react-start";
import { auth } from "#/features/auth/server/auth";

export const authMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) throw new Error("Unauthorized");
		return next({ context: { session } });
	},
);

export const adminMiddleware = createMiddleware()
	.middleware([authMiddleware])
	.server(({ next, context }) => {
		if (context.session.user.role !== "admin") throw new Error("Forbidden");
		return next();
	});
