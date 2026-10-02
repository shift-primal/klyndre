import type { ModuleName } from "@klyndre/config/schemas";
import { createFileRoute } from "@tanstack/react-router";
import { guildOptionsQuery } from "#/features/guilds/lib/guild-queries";
import { SettingsTabs } from "#/features/settings/components/settings-tabs";
import { moduleNames } from "#/features/settings/lib/fields";
import { guildSettingsQuery } from "#/features/settings/lib/settings-queries";

const parseTab = (value: unknown) => moduleNames.find((name) => name === value);

export const Route = createFileRoute("/_authed/guilds/$guildId/settings/")({
	validateSearch: (search: Record<string, unknown>): { tab?: ModuleName } => ({
		tab: parseTab(search.tab),
	}),
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.ensureQueryData(guildOptionsQuery(params.guildId)),
			...moduleNames.map((name) =>
				context.queryClient.ensureQueryData(
					guildSettingsQuery(params.guildId, name),
				),
			),
		]),
	component: SettingsPage,
});

function SettingsPage() {
	const { guildId } = Route.useParams();
	const { tab = "chat" } = Route.useSearch();
	const { session } = Route.useRouteContext();
	const navigate = Route.useNavigate();

	return (
		<SettingsTabs
			guildId={guildId}
			tab={tab}
			readOnly={session.user.role !== "admin"}
			onTabChange={(next) => navigate({ search: { tab: next }, replace: true })}
		/>
	);
}
