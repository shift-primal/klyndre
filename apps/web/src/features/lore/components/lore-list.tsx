import type { LoreKind } from "@klyndre/db/lore";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Item, ItemGroup } from "#/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
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

const kinds: { kind: LoreKind; label: string; about: string; empty: string }[] =
	[
		{
			kind: "self",
			label: "Self",
			about:
				"The life the bot makes up for itself while chatting: friends, family, its job, things it has done.",
			empty: "No lore about its own life yet.",
		},
		{
			kind: "server",
			label: "Server",
			about:
				"Running jokes and topics this server keeps coming back to. Never facts about one person, those are profiles.",
			empty: "No server lore yet.",
		},
	];

const blank: Fields = { key: "", notes: "", locked: false };

export const LoreList = ({ guildId, readOnly }: Props) => {
	const { data: lore } = useLore(guildId);
	const actions = useLoreActions(guildId);
	const [kind, setKind] = useState<LoreKind>("self");
	const [search, setSearch] = useState("");
	const [draft, setDraft] = useState<Fields | null>(null);

	const query = search.trim().toLowerCase();
	const switchTab = (next: LoreKind) => {
		setKind(next);
		setDraft(null);
	};

	return (
		<Tabs value={kind} onValueChange={(next) => switchTab(next as LoreKind)}>
			<TabsList>
				{kinds.map(({ kind, label }) => (
					<TabsTrigger key={kind} value={kind}>
						{label} ({lore.filter((entry) => entry.kind === kind).length})
					</TabsTrigger>
				))}
			</TabsList>
			{kinds.map(({ kind, about, empty }) => {
				const entries = lore.filter((entry) => entry.kind === kind);
				const unlocked = entries.filter((entry) => !entry.locked).length;
				const shown = entries.filter((entry) =>
					[entry.key, entry.notes].some((text) =>
						text.toLowerCase().includes(query),
					),
				);

				return (
					<TabsContent key={kind} value={kind} className="mt-2">
						<div className="flex flex-col gap-4">
							<p className="text-muted-foreground">{about}</p>
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
											disabled={
												unlocked === 0 || actions.removeUnlocked.isPending
											}
											onClick={() => {
												if (
													window.confirm(
														`Delete all ${unlocked} unlocked entries here? Locked ones stay.`,
													)
												) {
													actions.removeUnlocked.mutate(kind);
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
												actions.create.mutate(
													{ kind, ...draft },
													{ onSuccess: () => setDraft(null) },
												)
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
									{empty} The bot writes it as it chats
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
					</TabsContent>
				);
			})}
		</Tabs>
	);
};
