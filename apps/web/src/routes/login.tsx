import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { Button } from "#/components/shadcn/button";
import { Input } from "#/components/shadcn/input";
import { Label } from "#/components/shadcn/label";
import { LoginForm } from "#/components/ui/login";
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

	const loginFormProps = { error, pending, onSubmit };

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<LoginForm {...loginFormProps} />
		</div>
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
