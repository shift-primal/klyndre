import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { getSession } from "#/lib/auth.functions";
import { authClient } from "#/lib/auth-client";

const safeRedirect = (value: unknown) =>
	typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
		? value
		: undefined;

const Login = () => {
	const { redirect: redirectTo } = Route.useSearch();
	const router = useRouter();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setPending(true);
		const { error } = await authClient.signIn.email({
			email: String(form.get("email")),
			password: String(form.get("password")),
		});
		setPending(false);
		if (error) {
			setError(error.message ?? "Sign in failed");
			return;
		}
		await router.navigate({ href: redirectTo ?? "/" });
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
				<h1 className="text-2xl font-semibold">Sign in</h1>
				<div className="flex flex-col gap-2">
					<Label htmlFor="email">Email</Label>
					<Input id="email" name="email" type="email" required />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="password">Password</Label>
					<Input id="password" name="password" type="password" required />
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<Button type="submit" disabled={pending}>
					{pending ? "Signing in…" : "Sign in"}
				</Button>
			</form>
		</main>
	);
};

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: safeRedirect(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		if (await getSession()) throw redirect({ href: search.redirect ?? "/" });
	},
	component: Login,
});
