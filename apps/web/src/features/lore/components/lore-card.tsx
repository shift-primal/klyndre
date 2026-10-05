import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "#/components/ui/item";
import {
	isValidLore,
	LoreFields,
} from "#/features/lore/components/lore-fields";
import type {
	LoreFields as Fields,
	useLoreActions,
} from "#/features/lore/hooks/use-lore-actions";
import type { Lore } from "#/features/lore/lib/lore-queries";

type Props = {
	entry: Lore;
	actions: ReturnType<typeof useLoreActions>;
	readOnly: boolean;
};

export const LoreCard = ({ entry, actions, readOnly }: Props) => {
	// null until edited, so lore the bot rewrites shows up unless you're mid-edit
	const [draft, setDraft] = useState<Fields | null>(null);
	const value = draft ?? {
		key: entry.key,
		notes: entry.notes,
		locked: entry.locked,
	};
	const dirty =
		draft !== null &&
		(draft.key.trim() !== entry.key ||
			draft.notes.trim() !== entry.notes ||
			draft.locked !== entry.locked);
	const { update, remove } = actions;

	return (
		<Item variant="outline" className="flex-col items-stretch">
			<div className="flex items-start justify-between gap-2">
				<ItemContent>
					<ItemTitle>
						{entry.key}
						{entry.locked && (
							<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
								Locked
							</span>
						)}
					</ItemTitle>
					<ItemDescription>
						updated {new Date(entry.updatedAt).toLocaleString()}
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
								if (window.confirm(`Delete the lore on ${entry.key}?`)) {
									remove.mutate(entry.id);
								}
							}}
						>
							Delete
						</Button>
					</ItemActions>
				)}
			</div>
			{readOnly ? (
				<p className="whitespace-pre-wrap">{entry.notes}</p>
			) : (
				<>
					<LoreFields
						id={`lore-${entry.id}`}
						value={value}
						onChange={setDraft}
					/>
					{dirty && (
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								disabled={!isValidLore(value) || update.isPending}
								onClick={() =>
									update.mutate(
										{ id: entry.id, ...value },
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
