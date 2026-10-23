import { getSettings } from "@klyndre/config";
import {
	CHARACTER_TEXT_MAX,
	type CharacterEntry,
	type CharacterField,
	type CharacterFieldDefinition,
	characterEntries,
	characterField,
	characterFieldLocks,
	characterFieldNames,
	characterFields,
	db,
	type Transaction,
	withCharacterLock,
} from "@klyndre/db";
import { generateText, type ModelMessage, Output } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { chatModel } from "#/features/chat/model";
import type { ChatContext } from "#/features/chat/prompt";
import { withoutImages } from "#/features/chat/reply";
import { quotedFrom, textOf, transcriptOf } from "#/features/chat/transcript";

export type Sheet = { entries: CharacterEntry[]; locked: Set<CharacterField> };

type Who = Pick<ChatContext, "guildId" | "botName">;

const SKETCHES = 5;

const RETRY_FILL_AFTER_MS = 10 * 60_000;
const busy = new Set<string>();
const fillFailedAt = new Map<string, number>();

const claim = (guildId: string, job: string) => {
	if (busy.has(guildId)) {
		console.log(`[character] skipped ${job}, another job is running`);
		return false;
	}
	busy.add(guildId);
	return true;
};

const readSheet = async (
	from: Transaction | typeof db,
	guildId: string,
): Promise<Sheet> => {
	const [entries, locks] = await Promise.all([
		from
			.select()
			.from(characterEntries)
			.where(eq(characterEntries.guildId, guildId))
			.orderBy(asc(characterEntries.createdAt), asc(characterEntries.id)),
		from
			.select({ field: characterFieldLocks.field })
			.from(characterFieldLocks)
			.where(
				and(
					eq(characterFieldLocks.guildId, guildId),
					eq(characterFieldLocks.locked, true),
				),
			),
	]);
	return { entries, locked: new Set(locks.map(({ field }) => field)) };
};

export const loadSheet = (guildId: string) => readSheet(db, guildId);

const itemsIn = (sheet: Sheet, field: CharacterField) =>
	sheet.entries.filter((entry) => entry.field === field);

const label = (field: string) => field.charAt(0).toUpperCase() + field.slice(1);

const describe = (sheet: Sheet) =>
	characterFields
		.flatMap(({ field, kind }) => {
			const items = itemsIn(sheet, field).map((entry) => entry.text);
			if (items.length === 0) return [];
			return kind === "list"
				? [`- ${label(field)}:`, ...items.map((item) => `  - ${item}`)]
				: [`- ${label(field)}: ${items.join(" ")}`];
		})
		.join("\n");

const someOf = (items: CharacterEntry[], shown: number) => {
	if (shown === 0 || items.length <= shown) return items;
	const picked = [...items];
	for (let i = 0; i < shown; i++) {
		const j = i + Math.floor(Math.random() * (picked.length - i));
		[picked[i], picked[j]] = [
			picked[j] as CharacterEntry,
			picked[i] as CharacterEntry,
		];
	}
	return picked.slice(0, shown);
};

export const describeCharacter = (sheet: Sheet, quirksShown: number) => {
	const quirks = new Set(someOf(itemsIn(sheet, "quirks"), quirksShown));
	return describe({
		...sheet,
		entries: sheet.entries.filter(
			(entry) =>
				entry.field !== "stories" &&
				(entry.field !== "quirks" || quirks.has(entry)),
		),
	});
};

const blanksOf = (sheet: Sheet) =>
	characterFields.filter(
		({ field }) =>
			!sheet.locked.has(field) && itemsIn(sheet, field).length === 0,
	);

const sketchSchema = z.object({
	sketches: z
		.array(z.string())
		.describe(
			"One line each: age, where they live, what they do, their situation in life",
		),
});

async function sketch(model: string, instructions: string, known: string) {
	const { output } = await generateText({
		model: chatModel(model),
		instructions,
		messages: [
			{
				role: "user",
				content: [
					known && `## Already decided\n${known}`,
					`Sketch ${SKETCHES} people who could be this, as different from each other as you can: different ages, places, jobs and lives. Avoid the first idea that comes to mind.`,
				]
					.filter(Boolean)
					.join("\n\n"),
			},
		],
		output: Output.object({ schema: sketchSchema }),
		temperature: 1.2,
	});
	const sketches = output.sketches.filter((line) => line.trim());
	return sketches[Math.floor(Math.random() * sketches.length)] ?? "";
}

const fits = (text: string) =>
	text.length > 0 && text.length <= CHARACTER_TEXT_MAX;

const madeItems = (
	{ field, kind }: CharacterFieldDefinition,
	value: string | string[] | undefined,
) => {
	const items = (
		Array.isArray(value) ? value : value === undefined ? [] : [value]
	).map((item) => item.trim());
	for (const item of items.filter((item) => !fits(item))) {
		console.log(
			`[character] dropped made up ${field}: empty or too long "${item}"`,
		);
	}
	const kept = items.filter(fits);
	return kind === "text" ? kept.slice(0, 1) : kept;
};

async function fillBlanks({ guildId, botName }: Who, sheet: Sheet) {
	const blanks = blanksOf(sheet);
	const [{ model, timeZone }, { language }, { fillInstructions }] =
		await Promise.all([
			getSettings(guildId, "replies"),
			getSettings(guildId, "style"),
			getSettings(guildId, "internals"),
		]);
	const known = describe(sheet);
	const instructions = fillInstructions
		.replaceAll("{name}", botName)
		.replaceAll("{timeZone}", timeZone)
		.replaceAll("{language}", language || "the main language spoken there");
	const schema = z.object(
		Object.fromEntries(
			blanks.map(({ field, kind, description }) => [
				field,
				kind === "list"
					? z.array(z.string()).describe(`${description}, 2 to 4 items`)
					: z.string().describe(description),
			]),
		),
	);
	const base =
		blanks.length > characterFields.length / 2
			? await sketch(model, instructions, known)
			: "";

	const { output } = await generateText({
		model: chatModel(model),
		instructions,
		messages: [
			{
				role: "user",
				content: [
					`## Already filled in\n${known || "(nothing yet)"}`,
					base && `## Based on\n${base}`,
					`## Make up\n${blanks.map(({ field }) => field).join(", ")}`,
				]
					.filter(Boolean)
					.join("\n\n"),
			},
		],
		output: Output.object({ schema }),
		temperature: 1,
	});

	const made = blanks.map((definition) => ({
		definition,
		items: madeItems(
			definition,
			(output as Record<string, string | string[] | undefined>)[
				definition.field
			],
		),
	}));
	if (made.every(({ items }) => items.length === 0)) {
		throw new Error("made up nothing");
	}

	const filled = await withCharacterLock(guildId, async (tx) => {
		const still = new Set(
			blanksOf(await readSheet(tx, guildId)).map(({ field }) => field),
		);
		const rows = made.flatMap(({ definition: { field, cap }, items }) =>
			still.has(field)
				? items.slice(0, cap).map((text) => ({
						guildId,
						field,
						text,
						source: "filled" as const,
					}))
				: [],
		);
		if (rows.length > 0) await tx.insert(characterEntries).values(rows);
		return [...new Set(rows.map(({ field }) => field))];
	});
	if (filled.length > 0) {
		console.log(`[character] made up ${filled.join(", ")}`);
	}
}

export async function fillCharacter(guildId: string, botName: string) {
	const { makeUpBlanks } = await getSettings(guildId, "identity");
	if (!makeUpBlanks) return;
	const sheet = await loadSheet(guildId);
	if (blanksOf(sheet).length > 0) await fillBlanks({ guildId, botName }, sheet);
}

export async function maybeFillCharacter(who: Who) {
	const { guildId } = who;
	const { makeUpBlanks } = await getSettings(guildId, "identity");
	if (
		!makeUpBlanks ||
		Date.now() - (fillFailedAt.get(guildId) ?? 0) < RETRY_FILL_AFTER_MS
	) {
		return;
	}
	const sheet = await loadSheet(guildId);
	if (blanksOf(sheet).length === 0 || !claim(guildId, "filling")) return;

	try {
		await fillBlanks(who, sheet);
	} catch (error) {
		fillFailedAt.set(guildId, Date.now());
		console.error("[character]", error);
	} finally {
		busy.delete(guildId);
	}
}

const wordsOf = (text: string) =>
	new Set(
		text
			.toLowerCase()
			.replaceAll("’", "'")
			.split(/\s+/)
			.map((word) => word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
			.filter(Boolean),
	);

const talksAboutItself = (reply: string, selfWords: string[]) => {
	const said = wordsOf(reply);
	return selfWords.some((word) => [...wordsOf(word)].some((w) => said.has(w)));
};

const updateSchema = z.object({
	actions: z.array(
		z.object({
			op: z.enum(["add", "replace", "remove"]),
			field: z
				.enum(characterFieldNames)
				.nullable()
				.describe("For add, the field it goes in. Null for replace and remove"),
			id: z
				.int()
				.nullable()
				.describe("For replace and remove, the id of the item. Null for add"),
			text: z
				.string()
				.nullable()
				.describe(
					"For add and replace, the item's full new text. Null for remove",
				),
			evidence: z
				.string()
				.describe(
					"The bot's own words this is based on, copied exactly, one quote per line",
				),
		}),
	),
});
type Action = z.infer<typeof updateSchema>["actions"][number];

const describeForUpdate = (sheet: Sheet) =>
	characterFields
		.map(({ field, kind, cap }) => {
			const head = [
				field,
				kind === "text" ? "(one item)" : `(list, at most ${cap} items)`,
				sheet.locked.has(field) && "(locked, never change it)",
			]
				.filter(Boolean)
				.join(" ");
			const items = itemsIn(sheet, field).map(
				(entry) =>
					`- id ${entry.id} (${[entry.source, entry.locked && "locked"].filter(Boolean).join(", ")}): ${entry.text}`,
			);
			return `${head}:\n${items.join("\n") || "(empty)"}`;
		})
		.join("\n\n");

const what = (action: Action) =>
	action.op === "add"
		? `add to ${action.field ?? "?"}`
		: `${action.op} id ${action.id ?? "?"}`;

const stalest = (stories: CharacterEntry[]) =>
	stories
		.filter((story) => !story.locked)
		.sort(
			(a, b) =>
				(a.usedAt ?? a.createdAt).getTime() -
					(b.usedAt ?? b.createdAt).getTime() || a.id - b.id,
		)[0];

const applyActions = (guildId: string, actions: Action[], shown: Set<number>) =>
	withCharacterLock(guildId, async (tx) => {
		const log: string[] = [];
		const sheet = await readSheet(tx, guildId);
		const rows = sheet.entries;
		const drop = (action: Action, reason: string) =>
			log.push(`[character] dropped ${what(action)}: ${reason}`);
		const remove = async (row: CharacterEntry) => {
			await tx.delete(characterEntries).where(eq(characterEntries.id, row.id));
			rows.splice(rows.indexOf(row), 1);
		};

		for (const action of actions) {
			let row =
				action.op === "add" || action.id === null || !shown.has(action.id)
					? undefined
					: rows.find((entry) => entry.id === action.id);
			if (action.op !== "add" && !row) {
				drop(action, "bad id");
				continue;
			}
			const definition = characterField(row?.field ?? action.field ?? "");
			if (!definition) {
				drop(action, "bad id");
				continue;
			}
			const { field } = definition;
			if (sheet.locked.has(field) || row?.locked) {
				drop(action, "locked");
				continue;
			}

			if (action.op === "remove" && row) {
				if (row.source === "manual") {
					drop(action, "manual");
					continue;
				}
				await remove(row);
				log.push(`[character] - ${field}: ${row.text}`);
				continue;
			}

			const text = action.text?.trim() ?? "";
			if (!fits(text)) {
				drop(action, "empty or too long");
				continue;
			}

			if (action.op === "add" && definition.kind === "text") {
				row = rows.find((entry) => entry.field === field);
				if (row?.locked) {
					drop(action, "locked");
					continue;
				}
			}

			if (row) {
				if (row.text === text) continue;
				const set = { text, source: "chat" as const, updatedAt: new Date() };
				await tx
					.update(characterEntries)
					.set(set)
					.where(eq(characterEntries.id, row.id));
				Object.assign(row, set);
				log.push(`[character] ~ ${field}: ${text}`);
				continue;
			}

			const inField = rows.filter((entry) => entry.field === field);
			if (inField.length >= definition.cap) {
				const evict = field === "stories" ? stalest(inField) : undefined;
				if (!evict) {
					drop(
						action,
						field === "stories"
							? "over the cap, every story is locked"
							: "over the cap",
					);
					continue;
				}
				await remove(evict);
				log.push(`[character] evicted story: ${evict.text}`);
			}
			const [added] = await tx
				.insert(characterEntries)
				.values({ guildId, field, text, source: "chat" })
				.returning();
			if (added) rows.push(added);
			log.push(`[character] + ${field}: ${text}`);
		}

		return log;
	});

export async function maybeUpdateCharacter(
	{ guildId, botName }: Who,
	history: ModelMessage[],
	reply: string,
) {
	const { learnFromChat, selfWords, characterEvidenceWords } =
		await getSettings(guildId, "identity");
	if (!learnFromChat || !talksAboutItself(reply, selfWords)) return;
	if (!claim(guildId, "update")) return;

	try {
		const chat: ModelMessage[] = [
			...withoutImages(history),
			{ role: "assistant", content: reply },
		];
		const botLines = chat.filter((msg) => msg.role === "assistant").map(textOf);

		const [sheet, { model }, { characterInstructions }] = await Promise.all([
			loadSheet(guildId),
			getSettings(guildId, "replies"),
			getSettings(guildId, "internals"),
		]);
		const { output } = await generateText({
			model: chatModel(model),
			instructions: `${characterInstructions}\n\n## Character sheet\n${describeForUpdate(sheet)}`,
			messages: [
				{ role: "user", content: `## Chat\n${transcriptOf(chat, botName)}` },
			],
			output: Output.object({ schema: updateSchema }),
			temperature: 0,
		});

		const actions = output.actions.filter((action) => {
			if (quotedFrom(action.evidence, botLines, characterEvidenceWords)) {
				return true;
			}
			console.log(
				`[character] dropped ${what(action)}: no evidence in "${action.evidence}"`,
			);
			return false;
		});
		if (actions.length === 0) return;

		const shown = new Set(sheet.entries.map((entry) => entry.id));
		for (const line of await applyActions(guildId, actions, shown)) {
			console.log(line);
		}
	} catch (error) {
		console.error("[character]", error);
	} finally {
		busy.delete(guildId);
	}
}
