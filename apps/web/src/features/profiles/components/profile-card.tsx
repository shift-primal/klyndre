import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "#/components/ui/item";
import { Textarea } from "#/components/ui/textarea";
import type { useProfileActions } from "#/features/profiles/hooks/use-profile-actions";
import type { Profile } from "#/features/profiles/lib/profile-queries";

type Props = {
	profile: Profile;
	actions: ReturnType<typeof useProfileActions>;
	readOnly: boolean;
};

export const ProfileCard = ({ profile, actions, readOnly }: Props) => {
	// null until edited, so notes the bot rewrites show up unless you're mid-edit
	const [draft, setDraft] = useState<string | null>(null);
	const notes = draft ?? profile.notes;
	const dirty = draft !== null && draft.trim() !== profile.notes;
	const { update, remove } = actions;

	return (
		<Item variant="outline" className="flex-col items-stretch">
			<div className="flex items-start justify-between gap-2">
				<ItemContent>
					<ItemTitle>{profile.name}</ItemTitle>
					<ItemDescription>
						{profile.userId} · updated{" "}
						{new Date(profile.updatedAt).toLocaleString()}
					</ItemDescription>
				</ItemContent>
				{!readOnly && (
					<ItemActions>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={remove.isPending}
							onClick={() => {
								if (window.confirm(`Delete the notes on ${profile.name}?`)) {
									remove.mutate(profile.userId);
								}
							}}
						>
							Delete
						</Button>
					</ItemActions>
				)}
			</div>
			{readOnly ? (
				<p className="whitespace-pre-wrap">{profile.notes}</p>
			) : (
				<>
					<Textarea
						rows={3}
						value={notes}
						onChange={(event) => setDraft(event.target.value)}
						aria-label={`Notes on ${profile.name}`}
					/>
					{dirty && (
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								disabled={!notes.trim() || update.isPending}
								onClick={() =>
									update.mutate(
										{ userId: profile.userId, notes },
										{ onSuccess: () => setDraft(null) },
									)
								}
							>
								Save
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setDraft(null)}
							>
								Discard
							</Button>
						</div>
					)}
				</>
			)}
		</Item>
	);
};
