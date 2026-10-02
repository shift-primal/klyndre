import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	YoutubeCookiesForm,
	youtubeCookieInfoQuery,
} from "#/features/secrets/components/youtube-cookies-form";

export const Route = createFileRoute("/_authed/secrets")({
	beforeLoad: ({ context }) => {
		if (context.session.user.role !== "admin") throw redirect({ to: "/" });
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(youtubeCookieInfoQuery),
	component: SecretsPage,
});

function SecretsPage() {
	const { data } = useSuspenseQuery(youtubeCookieInfoQuery);
	return <YoutubeCookiesForm info={data} />;
}
