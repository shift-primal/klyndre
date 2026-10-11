import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "#/components/ui/button";
import { authClient } from "#/features/auth/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();
	const router = useRouter();

	if (isPending) {
		return <div className="bg-muted h-8 w-8 animate-pulse" />;
	}

	if (session?.user) {
		return (
			<div className="flex items-center justify-end gap-2">
				{session.user.image ? (
					<img src={session.user.image} alt="" className="h-8 w-8" />
				) : (
					<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
						<span className="text-muted-foreground text-xs font-medium">
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
