import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Item, ItemGroup } from "#/components/ui/item";
import { LoreCard } from "#/features/lore/components/lore-card";
import {
	isValidLore,
	LoreFields,
} from "#/features/lore/components/lore-fields";
import { useLore } from "#/features/lore/hooks/use-lore";
import {
	type LoreFields as Fields,
	useLoreActions,
} from "#/features/lore/hooks/use-lore-actions";

type Props = { guildId: string; readOnly: boolean };

const blank: Fields = { key: "", notes: "", locked: false };

export const LoreList = ({ guildId, readOnly }: Props) => {
	const { data: entries } = useLore(guildId);
	const actions = useLoreActions(guildId);
	const [search, setSearch] = useState("");
	const [draft, setDraft] = useState<Fields | null>(null);

	const query = search.trim().toLowerCase();
	const unlocked = entries.filter((entry) => !entry.locked).length;
	const shown = entries.filter((entry) =>
		[entry.key, entry.notes].some((text) => text.toLowerCase().includes(query)),
	);

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground">
				Running jokes and topics this server keeps coming back to. Never facts
				about one person, those are profiles, and never the bot's own life,
				that's its character.
			</p>
			<div className="flex gap-2">
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={`Search ${entries.length} entries`}
					aria-label="Search lore"
				/>
				{!readOnly && (
					<>
						<Button
							type="button"
							variant="outline"
							disabled={draft !== null}
							onClick={() => setDraft(blank)}
						>
							Add
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={unlocked === 0 || actions.removeUnlocked.isPending}
							onClick={() => {
								if (
									window.confirm(
										`Delete all ${unlocked} unlocked entries? Locked ones stay.`,
									)
								) {
									actions.removeUnlocked.mutate();
								}
							}}
						>
							Delete all unlocked
						</Button>
					</>
				)}
			</div>
			{draft && (
				<Item variant="outline" className="flex-col items-stretch">
					<LoreFields id="lore-new" value={draft} onChange={setDraft} />
					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							disabled={!isValidLore(draft) || actions.create.isPending}
							onClick={() =>
								actions.create.mutate(draft, {
									onSuccess: () => setDraft(null),
								})
							}
						>
							Add entry
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
			{entries.length === 0 ? (
				<p className="text-muted-foreground">
					No server lore yet. The bot writes it as it chats
					{readOnly ? "." : ", or you can add some yourself."}
				</p>
			) : shown.length === 0 ? (
				<p className="text-muted-foreground">No entries match.</p>
			) : (
				<ItemGroup>
					{shown.map((entry) => (
						<LoreCard
							key={entry.id}
							entry={entry}
							actions={actions}
							readOnly={readOnly}
						/>
					))}
				</ItemGroup>
			)}
		</div>
	);
};
