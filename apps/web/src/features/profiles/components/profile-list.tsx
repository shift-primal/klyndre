import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { ItemGroup } from "#/components/ui/item";
import { ProfileCard } from "#/features/profiles/components/profile-card";
import { useProfileActions } from "#/features/profiles/hooks/use-profile-actions";
import { useProfiles } from "#/features/profiles/hooks/use-profiles";

type Props = { guildId: string; readOnly: boolean };

export const ProfileList = ({ guildId, readOnly }: Props) => {
	const { data: profiles } = useProfiles(guildId);
	const actions = useProfileActions(guildId);
	const [search, setSearch] = useState("");

	const query = search.trim().toLowerCase();
	const shown = profiles.filter((profile) =>
		[profile.name, profile.userId, profile.notes].some((text) =>
			text.toLowerCase().includes(query),
		),
	);

	if (profiles.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No notes on anyone yet. The bot writes them as it chats.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex gap-2">
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={`Search ${profiles.length} profiles`}
				/>
				{!readOnly && (
					<Button
						type="button"
						variant="destructive"
						disabled={actions.removeAll.isPending}
						onClick={() => {
							if (
								window.confirm(
									`Delete the notes on all ${profiles.length} people in this server?`,
								)
							) {
								actions.removeAll.mutate();
							}
						}}
					>
						Delete all
					</Button>
				)}
			</div>
			{shown.length === 0 ? (
				<p className="text-sm text-muted-foreground">No profiles match.</p>
			) : (
				<ItemGroup>
					{shown.map((profile) => (
						<ProfileCard
							key={profile.userId}
							profile={profile}
							actions={actions}
							readOnly={readOnly}
						/>
					))}
				</ItemGroup>
			)}
		</div>
	);
};
