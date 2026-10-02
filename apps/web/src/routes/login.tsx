import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import type { SubmitEvent } from "react";
import { LoginForm } from "#/features/auth/components/login-form";
import { authClient } from "#/features/auth/lib/auth-client";
import { getSession } from "#/features/auth/server/auth.functions";

const safeRedirect = (value: unknown) =>
	typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
		? value
		: undefined;

const Login = () => {
	const { redirect: redirectTo } = Route.useSearch();
	const router = useRouter();

	const signIn = useMutation({
		mutationFn: async (credentials: { email: string; password: string }) => {
			const { error } = await authClient.signIn.email(credentials);
			if (error) throw new Error(error.message ?? "Sign in failed");
		},
		onSuccess: () => router.navigate({ href: redirectTo ?? "/" }),
	});

	const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		signIn.mutate({
			email: String(form.get("email")),
			password: String(form.get("password")),
		});
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<LoginForm
				error={signIn.error?.message}
				pending={signIn.isPending}
				onSubmit={onSubmit}
			/>
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
