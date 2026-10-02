import { useRouter } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();
	const router = useRouter();

	if (isPending) {
		return <div className="h-8 w-8 animate-pulse bg-muted" />;
	}

	if (session?.user) {
		return (
			<div className="flex items-center gap-2">
				{session.user.image ? (
					<img src={session.user.image} alt="" className="h-8 w-8" />
				) : (
					<div className="flex h-8 w-8 items-center justify-center bg-muted">
						<span className="text-xs font-medium text-muted-foreground">
							{session.user.name?.charAt(0).toUpperCase() || "U"}
						</span>
					</div>
				)}
				<Button
					variant="outline"
					onClick={async () => {
						await authClient.signOut();
						await router.invalidate();
					}}
				>
					Sign out
				</Button>
			</div>
		);
	}

	return null;
}
