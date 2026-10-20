import {
	type CharacterTrait,
	characterSettings,
	characterTraits,
	getSettings,
	type Settings,
	setSettings,
} from "@klyndre/config";
import { generateText, Output } from "ai";
import { z } from "zod";

import { chatModel } from "#/features/chat/model";

type Character = Settings<"character">;

const SKETCHES = 5;

// made up once per guild at a time, and not again for a while after it fails
const RETRY_FILL_AFTER_MS = 10 * 60_000;
const filling = new Set<string>();
const failedAt = new Map<string, number>();

// a text field or a list, as its non-empty lines
const itemsOf = (value: string | string[]) =>
	(Array.isArray(value) ? value : [value])
		.map((item) => item.trim())
		.filter(Boolean);

const isList = (trait: CharacterTrait) =>
	characterSettings.shape[trait].meta()?.widget === "list";

const blanksOf = (character: Character) =>
	characterTraits.filter((trait) => itemsOf(character[trait]).length === 0);

const describeOf = (trait: CharacterTrait) =>
	characterSettings.shape[trait].meta()?.description ?? trait;

const label = (trait: CharacterTrait) =>
	trait.charAt(0).toUpperCase() + trait.slice(1);

// "- Work: …" for the traits that are filled in, lists get one line per item below
export const describeCharacter = (character: Character) =>
	characterTraits
		.flatMap((trait) => {
			const items = itemsOf(character[trait]);
			if (items.length === 0) return [];
			return isList(trait)
				? [`- ${label(trait)}:`, ...items.map((item) => `  - ${item}`)]
				: [`- ${label(trait)}: ${items.join(" ")}`];
		})
		.join("\n");

// a few of its quirks, picked at random for each reply. With all of them in every
// prompt it uses every catchphrase in every message
export const withSomeQuirks = (
	character: Character,
	shown: number,
): Character => {
	if (shown === 0 || character.quirks.length <= shown) return character;
	const quirks = [...character.quirks];
	for (let i = 0; i < shown; i++) {
		const j = i + Math.floor(Math.random() * (quirks.length - i));
		[quirks[i], quirks[j]] = [quirks[j] as string, quirks[i] as string];
	}
	return { ...character, quirks: quirks.slice(0, shown) };
};

const sketchSchema = z.object({
	sketches: z
		.array(z.string())
		.describe(
			"One line each: age, where they live, what they do, their situation in life",
		),
});

// asked for one person, a model makes up nearly the same one every time,
// so it sketches a few different ones and one is picked at random
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

async function fillBlanks(
	guildId: string,
	botName: string,
	character: Character,
) {
	const blanks = blanksOf(character);
	const { model, timeZone, language } = await getSettings(guildId, "chat");
	const known = describeCharacter(character);
	const instructions = character.fillInstructions
		.replaceAll("{name}", botName)
		.replaceAll("{timeZone}", timeZone)
		.replaceAll("{language}", language || "the main language spoken there");
	const schema = z.object(
		Object.fromEntries(
			blanks.map((trait) => [
				trait,
				isList(trait)
					? z.array(z.string()).describe(`${describeOf(trait)}, 2 to 4 items`)
					: z.string().describe(describeOf(trait)),
			]),
		),
	);
	// with most of the sheet filled in, that already says who they are
	const base =
		blanks.length > characterTraits.length / 2
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
					`## Make up\n${blanks.join(", ")}`,
				]
					.filter(Boolean)
					.join("\n\n"),
			},
		],
		output: Output.object({ schema }),
		temperature: 1,
	});

	const made = Object.fromEntries(
		blanks.flatMap((trait) => {
			const value = (output as Record<string, string | string[] | undefined>)[
				trait
			];
			const items = value === undefined ? [] : itemsOf(value);
			if (items.length === 0) return [];
			return [[trait, isList(trait) ? items : items.join(" ")]];
		}),
	);
	if (Object.keys(made).length === 0) throw new Error("made up nothing");
	await setSettings(guildId, "character", made);
	console.log(`[character] made up ${Object.keys(made).join(", ")}`);
}

// for scripts: makes up the blank fields now and waits for it
export async function fillCharacter(guildId: string, botName: string) {
	const character = await getSettings(guildId, "character");
	if (character.fillBlanks && blanksOf(character).length > 0) {
		await fillBlanks(guildId, botName, character);
	}
}

// blank fields get made up in the background, it takes several seconds, so the
// reply that set it off goes without them and the next ones have them
export async function loadCharacter(guildId: string, botName: string) {
	const character = await getSettings(guildId, "character");
	const due =
		character.fillBlanks &&
		blanksOf(character).length > 0 &&
		!filling.has(guildId) &&
		Date.now() - (failedAt.get(guildId) ?? 0) >= RETRY_FILL_AFTER_MS;
	if (due) {
		filling.add(guildId);
		fillBlanks(guildId, botName, character)
			.catch((error) => {
				failedAt.set(guildId, Date.now());
				console.error("[character]", error);
			})
			.finally(() => filling.delete(guildId));
	}
	return character;
}
