import { useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "#/components/ui/field";
import { Item, ItemGroup } from "#/components/ui/item";
import { Switch } from "#/components/ui/switch";
import { CharacterItem } from "#/features/character/components/character-item";
import {
	ItemFields,
	isValidItem,
} from "#/features/character/components/item-fields";
import { useCharacter } from "#/features/character/hooks/use-character";
import {
	type ItemFields as Fields,
	useCharacterActions,
} from "#/features/character/hooks/use-character-actions";
import type { CharacterSection } from "#/features/character/lib/character-queries";

type Props = { guildId: string; readOnly: boolean };

const blank: Fields = { text: "", locked: false };

const label = (field: string) => field.charAt(0).toUpperCase() + field.slice(1);

const lockNote = (field: string) =>
	field === "stories"
		? "A locked story stays as written, but it still only goes in the prompt when the chat brings it up (unlike locked lore, which always does)."
		: "A locked item stays as written, the bot never changes or removes it.";

const Section = ({
	section,
	actions,
	readOnly,
}: {
	section: CharacterSection;
	actions: ReturnType<typeof useCharacterActions>;
	readOnly: boolean;
}) => {
	const [draft, setDraft] = useState<Fields | null>(null);
	const { field, description, cap, locked, items } = section;
	const full = items.length >= cap;
	const lockId = `character-${field}-locked`;

	return (
		<section className="flex flex-col gap-3" aria-labelledby={`${field}-title`}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h2 id={`${field}-title`} className="text-lg font-medium">
						{label(field)}{" "}
						<span className="text-muted-foreground text-sm font-normal">
							{items.length} / {cap}
						</span>
					</h2>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
				{!readOnly && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={full || draft !== null}
						onClick={() => setDraft(blank)}
					>
						Add
					</Button>
				)}
			</div>
			<Field orientation="horizontal">
				<Switch
					id={lockId}
					checked={locked}
					onCheckedChange={(next) =>
						actions.lockField.mutate({ field, locked: next })
					}
					disabled={readOnly || actions.lockField.isPending}
				/>
				<FieldContent>
					<FieldLabel htmlFor={lockId}>Lock {field}</FieldLabel>
					<FieldDescription>
						The bot never adds to, changes or makes up a locked field.{" "}
						{lockNote(field)}
					</FieldDescription>
				</FieldContent>
			</Field>
			{draft && (
				<Item variant="outline" className="flex-col items-stretch">
					<ItemFields
						id={`character-${field}-new`}
						value={draft}
						onChange={setDraft}
					/>
					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							disabled={!isValidItem(draft) || actions.add.isPending}
							onClick={() =>
								actions.add.mutate(
									{ field, text: draft.text.trim(), locked: draft.locked },
									{ onSuccess: () => setDraft(null) },
								)
							}
						>
							Add item
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setDraft(null)}
						>
							Cancel
						</Button>
					</div>
				</Item>
			)}
			{items.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{locked
						? "Empty and locked, so it stays empty."
						: "Empty. The bot makes it up the next time it chats, if making up blanks is on."}
				</p>
			) : (
				<ItemGroup>
					{items.map((item) => (
						<CharacterItem
							key={item.id}
							item={item}
							actions={actions}
							readOnly={readOnly}
						/>
					))}
				</ItemGroup>
			)}
		</section>
	);
};

export const CharacterSheet = ({ guildId, readOnly }: Props) => {
	const { data: sections } = useCharacter(guildId);
	const actions = useCharacterActions(guildId);

	return (
		<div className="flex flex-col gap-8">
			<p className="text-muted-foreground">
				Everything about the bot's own life. Badges show what you wrote, what it
				made up, and what it learned from what it said in chat.
			</p>
			{sections.map((section) => (
				<Section
					key={section.field}
					section={section}
					actions={actions}
					readOnly={readOnly}
				/>
			))}
		</div>
	);
};
