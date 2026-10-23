import type { CharacterSource } from "@klyndre/db/character";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Item, ItemActions, ItemContent } from "#/components/ui/item";
import {
	ItemFields,
	isValidItem,
} from "#/features/character/components/item-fields";
import type {
	ItemFields as Fields,
	useCharacterActions,
} from "#/features/character/hooks/use-character-actions";
import type { CharacterItem as Entry } from "#/features/character/lib/character-queries";

type Props = {
	item: Entry;
	actions: ReturnType<typeof useCharacterActions>;
	readOnly: boolean;
};

const sources: Record<CharacterSource, string> = {
	manual: "Yours",
	filled: "Made up",
	chat: "Learned",
};

const Badge = ({ children }: { children: string }) => (
	<span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
		{children}
	</span>
);

export const CharacterItem = ({ item, actions, readOnly }: Props) => {
	const [draft, setDraft] = useState<Fields | null>(null);
	const value = draft ?? { text: item.text, locked: item.locked };
	const dirty =
		draft !== null &&
		(draft.text.trim() !== item.text || draft.locked !== item.locked);
	const { update, remove } = actions;

	return (
		<Item variant="outline" className="flex-col items-stretch">
			<div className="flex items-start justify-between gap-2">
				<ItemContent className="flex-row flex-wrap gap-1.5">
					<Badge>{sources[item.source]}</Badge>
					{item.locked && <Badge>Locked</Badge>}
				</ItemContent>
				{!readOnly && (
					<ItemActions>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={remove.isPending}
							onClick={() => {
								if (window.confirm(`Delete "${item.text}"?`)) {
									remove.mutate(item.id);
								}
							}}
						>
							Delete
						</Button>
					</ItemActions>
				)}
			</div>
			{readOnly ? (
				<p className="whitespace-pre-wrap">{item.text}</p>
			) : (
				<>
					<ItemFields
						id={`character-${item.id}`}
						value={value}
						onChange={setDraft}
					/>
					{dirty && (
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								disabled={!isValidItem(value) || update.isPending}
								onClick={() =>
									update.mutate(
										{
											id: item.id,
											text: value.text.trim(),
											locked: value.locked,
										},
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
