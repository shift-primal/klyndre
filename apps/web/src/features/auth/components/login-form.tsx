import type { SubmitEvent } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

export interface LoginFormProps {
	error: string | undefined;
	pending: boolean;
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}

export const LoginForm = ({ error, pending, onSubmit }: LoginFormProps) => {
	return (
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
	);
};
