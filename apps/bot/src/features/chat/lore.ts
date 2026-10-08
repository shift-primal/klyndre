import { getSettings, type Settings } from "@klyndre/config";
import {
	db,
	LORE_KEY_MAX,
	LORE_NOTES_MAX,
	type LoreEntry,
	type LoreKind,
	loreEntries,
	loreKinds,
} from "@klyndre/db";
import { generateText, type ModelMessage, Output } from "ai";
import type { Message } from "discord.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { chatModel } from "#/features/chat/model";
import { botNameOf } from "#/features/chat/prompt";
import { withoutImages } from "#/features/chat/reply";
import { words } from "#/lib/utils/text";

type ChatSettings = Settings<"chat">;

// word → weight, key words count double
type Markers = Map<string, number>;

export type Unprompted = { entry: LoreEntry; markers: Markers };

export type SelectedLore = {
	self: LoreEntry[];
	server: LoreEntry[];
	// shown without anyone mentioning them, so they go on cooldown once used
	unprompted: Unprompted[];
};

const NO_LORE: SelectedLore = { self: [], server: [], unprompted: [] };

export const loadLore = (guildId: string) =>
	db.select().from(loreEntries).where(eq(loreEntries.guildId, guildId));

const letters = (word: string) => [...word].length;

// key words, plus note words rare enough in this guild's lore to point at one entry
const markersOf = (entries: LoreEntry[], settings: ChatSettings) => {
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

const rank = (
	entries: LoreEntry[],
	text: string,
	markers: Map<number, Markers>,
) => {
	const said = words(text);
	return entries.map((entry) => ({
		entry,
		score: scoreOf(markers.get(entry.id), said),
	}));
};

// per channel: entry id → replies left before it can come up unprompted again
const cooldowns = new Map<string, Map<number, number>>();

const resting = (channelId: string, entry: LoreEntry) =>
	(cooldowns.get(channelId)?.get(entry.id) ?? 0) > 0;

const shuffle = <T>(items: T[]) => {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy;
};

// humanText is only what people wrote, so the bot can't keep its own topics alive
export function selectLore(
	entries: LoreEntry[],
	humanText: string,
	channelId: string,
	settings: ChatSettings,
): SelectedLore {
	const markers = markersOf(entries, settings);
	const scored = rank(entries, humanText, markers);

	const matched = scored
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, settings.loreShown);
	const shown = new Set(matched.map(({ entry }) => entry));

	// someone just mentioning it always brings it back, cooldown or not
	const locked = scored.filter(
		({ entry, score }) =>
			entry.locked &&
			!shown.has(entry) &&
			(score > 0 || !resting(channelId, entry)),
	);
	const random = shuffle(
		scored.filter(
			({ entry, score }) =>
				entry.kind === "self" &&
				!entry.locked &&
				score === 0 &&
				!resting(channelId, entry),
		),
	).slice(0, settings.loreRandomFill);

	const picked = [...matched, ...locked, ...random].map(({ entry }) => entry);
	return {
		self: picked.filter((entry) => entry.kind === "self"),
		server: picked.filter((entry) => entry.kind === "server"),
		unprompted: [...locked, ...random]
			.filter(({ score }) => score === 0)
			.map(({ entry }) => ({
				entry,
				markers: markers.get(entry.id) ?? new Map(),
			})),
	};
}

export async function pickLore(message: Message<true>, humanText: string) {
	const settings = await getSettings(message.guildId, "chat");
	if (!settings.loreEnabled) return NO_LORE;
	const entries = await loadLore(message.guildId);
	return selectLore(entries, humanText, message.channelId, settings);
}

export async function noteUsage(
	message: Message<true>,
	unprompted: Unprompted[],
	reply: string,
) {
	const { loreCooldownReplies } = await getSettings(message.guildId, "chat");
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

const updateSchema = z.object({
	changes: z.array(
		z.object({
			kind: z
				.enum(loreKinds)
				.describe(
					"self: the bot's own life, from its own lines. server: something the group shares",
				),
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
					"Words copied exactly from the chat that this is based on, one quote per line. For self, only from the bot's own lines",
				),
		}),
	),
});
type Change = z.infer<typeof updateSchema>["changes"][number];

const phrase = (text: string) =>
	(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");

// self lore must be quoted from the bot's own lines, so it can't take on someone else's life
const backedUp = (
	change: Change,
	lines: { bot: string[]; all: string[] },
	minWords: number,
) => {
	const quotes = change.evidence
		.split(/\n|\.{3}|…/)
		.map(phrase)
		.filter(Boolean);
	const words = quotes.join(" ").split(" ").filter(Boolean).length;
	if (quotes.length === 0 || words < minWords) return false;
	const source = (change.kind === "self" ? lines.bot : lines.all).map(phrase);
	return quotes.every((quote) => source.some((line) => line.includes(quote)));
};

const textOf = ({ content }: ModelMessage) =>
	typeof content === "string"
		? content
		: content.map((part) => (part.type === "text" ? part.text : "")).join(" ");

// the most relevant entries and every locked one in full, the rest by key only
const describeKnown = (
	entries: LoreEntry[],
	chat: string,
	settings: ChatSettings,
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

	return loreKinds
		.map((kind) => {
			const lines = entries
				.filter((entry) => entry.kind === kind && full.has(entry))
				.map(
					(entry) =>
						`- ${entry.key}${entry.locked ? " (locked, never change it)" : ""}: ${entry.notes}`,
				);
			const others = entries
				.filter((entry) => entry.kind === kind && !full.has(entry))
				.map((entry) => entry.key);
			if (others.length > 0) lines.push(`- other keys: ${others.join(", ")}`);
			return `${kind}:\n${lines.join("\n") || "(none yet)"}`;
		})
		.join("\n\n");
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const label = (kind: LoreKind, key: string) => `${kind}/${key}`;

// returns log lines, printed only once the transaction commits
const applyChanges = (
	guildId: string,
	changes: Change[],
	settings: ChatSettings,
) =>
	db.transaction(async (tx) => {
		const log: string[] = [];
		const rows = await tx
			.select()
			.from(loreEntries)
			.where(eq(loreEntries.guildId, guildId));
		const find = (kind: LoreKind, key: string) =>
			rows.find((row) => row.kind === kind && same(row.key, key));
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
			const { kind } = change;
			const key = change.key.trim();
			const notes = change.notes.trim();
			const replaces = change.replaces?.trim() ?? "";
			const name = label(kind, key);

			if (
				!key ||
				!notes ||
				key.length > LORE_KEY_MAX ||
				notes.length > LORE_NOTES_MAX
			) {
				log.push(`[lore] dropped ${name}: empty or too long`);
				continue;
			}

			const existing = find(kind, key);
			const old =
				replaces && !same(replaces, key) ? find(kind, replaces) : undefined;
			if (existing?.locked || old?.locked) {
				log.push(`[lore] dropped ${name}: locked`);
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
				log.push(`[lore] > ${label(kind, from)} → ${key}: ${notes}`);
				continue;
			}

			if (existing) {
				if (existing.notes === notes) continue;
				await save(existing, { notes });
				log.push(`[lore] ~ ${label(kind, existing.key)}: ${notes}`);
				continue;
			}

			if (added >= settings.loreMaxNewPerUpdate) {
				log.push(`[lore] dropped ${name}: over the new entry cap`);
				continue;
			}
			const [row] = await tx
				.insert(loreEntries)
				.values({ guildId, kind, key, notes })
				.returning();
			if (row) rows.push(row);
			added++;
			log.push(`[lore] + ${name}: ${notes}`);
		}

		const stale = await tx
			.select({
				id: loreEntries.id,
				kind: loreEntries.kind,
				key: loreEntries.key,
			})
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
			for (const { kind, key } of stale) {
				log.push(`[lore] evicted ${label(kind, key)}`);
			}
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
	const settings = await getSettings(guildId, "chat");
	if (!settings.loreEnabled) return;

	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	// one run per guild at a time; a channel that got skipped tries again next reply
	if (count < settings.loreUpdateEvery || updating.has(guildId)) return;
	repliesSinceUpdate.set(channelId, 0);
	updating.add(guildId);

	try {
		// it reads the reply it just sent too, that's where its own life gets made up
		const chat: ModelMessage[] = [
			...withoutImages(history),
			{ role: "assistant", content: reply },
		];
		const lines = {
			bot: chat.filter((msg) => msg.role === "assistant").map(textOf),
			all: chat.map(textOf),
		};
		const botName = botNameOf(message);
		const transcript = chat
			.map((msg) =>
				msg.role === "assistant"
					? `${botName} (bot): ${textOf(msg)}`
					: textOf(msg),
			)
			.join("\n");

		const [entries, { loreInstructions }] = await Promise.all([
			loadLore(guildId),
			getSettings(guildId, "personality"),
		]);
		const known = describeKnown(entries, lines.all.join("\n"), settings);

		const { output } = await generateText({
			model: chatModel(settings.model),
			instructions: `${loreInstructions}\n\n## Known lore\n${known}`,
			messages: [{ role: "user", content: `## Chat\n${transcript}` }],
			output: Output.object({ schema: updateSchema }),
		});

		const changes = output.changes.filter((change) => {
			if (backedUp(change, lines, settings.loreEvidenceWords)) return true;
			console.log(
				`[lore] dropped ${change.kind}/${change.key}: not backed up by "${change.evidence}"`,
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
