import { getSettings, type Settings } from "@klyndre/config";
import {
	type CharacterEntry,
	characterEntries,
	db,
	LORE_KEY_MAX,
	LORE_NOTES_MAX,
	type LoreEntry,
	loreEntries,
} from "@klyndre/db";
import { generateText, type ModelMessage, Output } from "ai";
import type { Message } from "discord.js";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { chatModel } from "#/features/chat/model";
import { botNameOf } from "#/features/chat/prompt";
import { withoutImages } from "#/features/chat/reply";
import { quotedFrom, textOf, transcriptOf } from "#/features/chat/transcript";
import { words } from "#/lib/utils/text";

type MemorySettings = Settings<"memory">;

type Markers = Map<string, number>;

export type Unprompted = { entry: LoreEntry; markers: Markers };

export type SelectedLore = {
	server: LoreEntry[];
	unprompted: Unprompted[];
};

const NO_LORE: SelectedLore = { server: [], unprompted: [] };

type Rankable = { id: number; key: string; notes: string };

export const loadLore = (guildId: string) =>
	db.select().from(loreEntries).where(eq(loreEntries.guildId, guildId));

const letters = (word: string) => [...word].length;

const markersOf = (entries: Rankable[], settings: MemorySettings) => {
	const noteWords = new Map(
		entries.map((entry) => [
			entry.id,
			[...words(entry.notes)].filter(
				(word) => letters(word) >= settings.loreNoteWordLength,
			),
		]),
	);
	const usedBy = new Map<string, number>();
	for (const list of noteWords.values()) {
		for (const word of list) usedBy.set(word, (usedBy.get(word) ?? 0) + 1);
	}

	return new Map(
		entries.map((entry): [number, Markers] => {
			const markers: Markers = new Map();
			for (const word of noteWords.get(entry.id) ?? []) {
				if ((usedBy.get(word) ?? 0) < settings.loreRareWordLimit) {
					markers.set(word, 1);
				}
			}
			for (const word of words(entry.key)) {
				if (letters(word) >= settings.loreKeyWordLength) markers.set(word, 2);
			}
			return [entry.id, markers];
		}),
	);
};

const scoreOf = (markers: Markers | undefined, said: Set<string>) => {
	let score = 0;
	for (const [word, weight] of markers ?? []) {
		if (said.has(word)) score += weight;
	}
	return score;
};

const rank = <T extends Rankable>(
	entries: T[],
	text: string,
	markers: Map<number, Markers>,
) => {
	const said = words(text);
	return entries.map((entry) => ({
		entry,
		score: scoreOf(markers.get(entry.id), said),
	}));
};

const cooldowns = new Map<string, Map<number, number>>();

const resting = (channelId: string, entry: LoreEntry) =>
	(cooldowns.get(channelId)?.get(entry.id) ?? 0) > 0;

export function selectLore(
	entries: LoreEntry[],
	humanText: string,
	channelId: string,
	settings: MemorySettings,
): SelectedLore {
	const markers = markersOf(entries, settings);
	const scored = rank(entries, humanText, markers);

	const matched = scored
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, settings.loreShown);
	const shown = new Set(matched.map(({ entry }) => entry));

	const locked = scored.filter(
		({ entry, score }) =>
			entry.locked &&
			!shown.has(entry) &&
			(score > 0 || !resting(channelId, entry)),
	);

	return {
		server: [...matched, ...locked].map(({ entry }) => entry),
		unprompted: locked
			.filter(({ score }) => score === 0)
			.map(({ entry }) => ({
				entry,
				markers: markers.get(entry.id) ?? new Map(),
			})),
	};
}

export async function pickLore(message: Message<true>, humanText: string) {
	const settings = await getSettings(message.guildId, "memory");
	if (!settings.loreEnabled) return NO_LORE;
	const entries = await loadLore(message.guildId);
	return selectLore(entries, humanText, message.channelId, settings);
}

export async function noteUsage(
	message: Message<true>,
	unprompted: Unprompted[],
	reply: string,
) {
	const { loreCooldownReplies } = await getSettings(message.guildId, "memory");
	const channel = cooldowns.get(message.channelId) ?? new Map<number, number>();

	for (const [id, left] of channel) {
		if (left > 1) channel.set(id, left - 1);
		else channel.delete(id);
	}

	const said = words(reply);
	if (loreCooldownReplies > 0) {
		for (const { entry, markers } of unprompted) {
			if (scoreOf(markers, said) > 0)
				channel.set(entry.id, loreCooldownReplies);
		}
	}

	if (channel.size > 0) cooldowns.set(message.channelId, channel);
	else cooldowns.delete(message.channelId);
}

export async function pickStories(
	guildId: string,
	humanText: string,
): Promise<CharacterEntry[]> {
	const [{ storiesShown }, settings] = await Promise.all([
		getSettings(guildId, "identity"),
		getSettings(guildId, "memory"),
	]);
	if (storiesShown === 0) return [];

	const stories = await db
		.select()
		.from(characterEntries)
		.where(
			and(
				eq(characterEntries.guildId, guildId),
				eq(characterEntries.field, "stories"),
			),
		)
		.orderBy(asc(characterEntries.createdAt), asc(characterEntries.id));
	const items = stories.map((story) => ({
		id: story.id,
		key: "",
		notes: story.text,
		story,
	}));
	const picked = new Set(
		rank(items, humanText, markersOf(items, settings))
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, storiesShown)
			.map(({ entry }) => entry.story),
	);
	return stories.filter((story) => picked.has(story));
}

export async function noteStoriesUsed(stories: CharacterEntry[]) {
	if (stories.length === 0) return;
	await db
		.update(characterEntries)
		.set({ usedAt: new Date() })
		.where(
			inArray(
				characterEntries.id,
				stories.map(({ id }) => id),
			),
		);
}

const updateSchema = z.object({
	changes: z.array(
		z.object({
			key: z
				.string()
				.describe(
					"Just the name when there is one (Arne), otherwise a short description (the cousin)",
				),
			notes: z.string(),
			replaces: z
				.string()
				.nullable()
				.describe("The old key this entry gets renamed from, or null"),
			evidence: z
				.string()
				.describe(
					"Words copied exactly from the chat that this is based on, one quote per line",
				),
		}),
	),
});
type Change = z.infer<typeof updateSchema>["changes"][number];

const describeKnown = (
	entries: LoreEntry[],
	chat: string,
	settings: MemorySettings,
) => {
	const ranked = rank(entries, chat, markersOf(entries, settings)).sort(
		(a, b) =>
			b.score - a.score ||
			b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime(),
	);
	const full = new Set(
		ranked.slice(0, settings.loreUpdateContext).map(({ entry }) => entry),
	);
	for (const entry of entries) if (entry.locked) full.add(entry);

	const lines = entries
		.filter((entry) => full.has(entry))
		.map(
			(entry) =>
				`- ${entry.key}${entry.locked ? " (locked, never change it)" : ""}: ${entry.notes}`,
		);
	const others = entries
		.filter((entry) => !full.has(entry))
		.map((entry) => entry.key);
	if (others.length > 0) lines.push(`- other keys: ${others.join(", ")}`);
	return lines.join("\n") || "(none yet)";
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const applyChanges = (
	guildId: string,
	changes: Change[],
	settings: MemorySettings,
) =>
	db.transaction(async (tx) => {
		const log: string[] = [];
		const rows = await tx
			.select()
			.from(loreEntries)
			.where(eq(loreEntries.guildId, guildId));
		const find = (key: string) => rows.find((row) => same(row.key, key));
		const save = async (
			row: LoreEntry,
			set: Partial<Pick<LoreEntry, "key" | "notes">>,
		) => {
			const updatedAt = new Date();
			await tx
				.update(loreEntries)
				.set({ ...set, updatedAt })
				.where(eq(loreEntries.id, row.id));
			Object.assign(row, set, { updatedAt });
		};
		let added = 0;

		for (const change of changes) {
			const key = change.key.trim();
			const notes = change.notes.trim();
			const replaces = change.replaces?.trim() ?? "";

			if (
				!key ||
				!notes ||
				key.length > LORE_KEY_MAX ||
				notes.length > LORE_NOTES_MAX
			) {
				log.push(`[lore] dropped ${key}: empty or too long`);
				continue;
			}

			const existing = find(key);
			const old = replaces && !same(replaces, key) ? find(replaces) : undefined;
			if (existing?.locked || old?.locked) {
				log.push(`[lore] dropped ${key}: locked`);
				continue;
			}

			if (old) {
				const from = old.key;
				if (existing) {
					await save(existing, { notes });
					await tx.delete(loreEntries).where(eq(loreEntries.id, old.id));
					rows.splice(rows.indexOf(old), 1);
				} else {
					await save(old, { key, notes });
				}
				log.push(`[lore] > ${from} → ${key}: ${notes}`);
				continue;
			}

			if (existing) {
				if (existing.notes === notes) continue;
				await save(existing, { notes });
				log.push(`[lore] ~ ${existing.key}: ${notes}`);
				continue;
			}

			if (added >= settings.loreMaxNewPerUpdate) {
				log.push(`[lore] dropped ${key}: over the new entry cap`);
				continue;
			}
			const [row] = await tx
				.insert(loreEntries)
				.values({ guildId, key, notes })
				.returning();
			if (row) rows.push(row);
			added++;
			log.push(`[lore] + ${key}: ${notes}`);
		}

		const stale = await tx
			.select({ id: loreEntries.id, key: loreEntries.key })
			.from(loreEntries)
			.where(
				and(eq(loreEntries.guildId, guildId), eq(loreEntries.locked, false)),
			)
			.orderBy(desc(loreEntries.updatedAt), desc(loreEntries.id))
			.offset(settings.loreMaxEntries);
		if (stale.length > 0) {
			await tx.delete(loreEntries).where(
				inArray(
					loreEntries.id,
					stale.map(({ id }) => id),
				),
			);
			for (const { key } of stale) log.push(`[lore] evicted ${key}`);
		}

		return log;
	});

const repliesSinceUpdate = new Map<string, number>();
const updating = new Set<string>();

export async function maybeUpdateLore(
	message: Message<true>,
	history: ModelMessage[],
	reply: string,
) {
	const { channelId, guildId } = message;
	const settings = await getSettings(guildId, "memory");
	if (!settings.loreEnabled) return;

	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	if (count < settings.loreUpdateEvery || updating.has(guildId)) return;
	repliesSinceUpdate.set(channelId, 0);
	updating.add(guildId);

	try {
		const chat: ModelMessage[] = [
			...withoutImages(history),
			{ role: "assistant", content: reply },
		];
		const lines = chat.map(textOf);
		const transcript = transcriptOf(chat, botNameOf(message));

		const [entries, { model }, { loreInstructions }] = await Promise.all([
			loadLore(guildId),
			getSettings(guildId, "replies"),
			getSettings(guildId, "internals"),
		]);
		const known = describeKnown(entries, lines.join("\n"), settings);

		const { output } = await generateText({
			model: chatModel(model),
			instructions: `${loreInstructions}\n\n## Known lore\n${known}`,
			messages: [{ role: "user", content: `## Chat\n${transcript}` }],
			output: Output.object({ schema: updateSchema }),
		});

		const changes = output.changes.filter((change) => {
			if (quotedFrom(change.evidence, lines, settings.loreEvidenceWords)) {
				return true;
			}
			console.log(
				`[lore] dropped ${change.key}: not backed up by "${change.evidence}"`,
			);
			return false;
		});
		for (const line of await applyChanges(guildId, changes, settings)) {
			console.log(line);
		}
	} catch (error) {
		console.error("[lore]", error);
	} finally {
		updating.delete(guildId);
	}
}
