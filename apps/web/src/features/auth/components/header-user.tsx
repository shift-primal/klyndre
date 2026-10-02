import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "#/components/ui/button";
import { authClient } from "#/features/auth/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();
	const router = useRouter();

	if (isPending) {
		return <div className="h-8 w-8 animate-pulse bg-muted" />;
	}

	if (session?.user) {
		return (
			<div className="flex items-center gap-2 justify-end">
				{session.user.image ? (
					<img src={session.user.image} alt="" className="h-8 w-8" />
				) : (
					<div className="flex h-8 w-8 items-center justify-center bg-muted rounded-full">
						<span className="text-xs font-medium text-muted-foreground">
							{session.user.name?.charAt(0).toUpperCase() || "U"}
						</span>
					</div>
				)}
				<Button
					variant="outline"
					size="icon-xs"
					onClick={async () => {
						await authClient.signOut();
						await router.invalidate();
					}}
				>
					<LogOut />
				</Button>
			</div>
		);
	}

	return null;
}
