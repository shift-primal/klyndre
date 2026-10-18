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

// made up once per guild at a time, every reply waiting on it gets the same one
const filling = new Map<string, Promise<Character>>();

const blanksOf = (character: Character) =>
	characterTraits.filter((trait) => !character[trait].trim());

const describeOf = (trait: CharacterTrait) =>
	characterSettings.shape[trait].meta()?.description ?? trait;

const label = (trait: CharacterTrait) =>
	trait.charAt(0).toUpperCase() + trait.slice(1);

// "- Work: …" lines for the traits that are filled in
export const describeCharacter = (character: Character) =>
	characterTraits
		.filter((trait) => character[trait].trim())
		.map((trait) => `- ${label(trait)}: ${character[trait].trim()}`)
		.join("\n");

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
			blanks.map((trait) => [trait, z.string().describe(describeOf(trait))]),
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
			const value = (output as Record<string, string | undefined>)[trait];
			return value?.trim() ? [[trait, value.trim()]] : [];
		}),
	);
	if (Object.keys(made).length === 0) return character;
	console.log(`[character] made up ${Object.keys(made).join(", ")}`);
	return setSettings(guildId, "character", made);
}

// the character sheet, made up and saved first when fields are blank
export async function loadCharacter(guildId: string, botName: string) {
	const character = await getSettings(guildId, "character");
	if (!character.fillBlanks || blanksOf(character).length === 0) {
		return character;
	}

	const running = filling.get(guildId);
	if (running) return running;
	const next = fillBlanks(guildId, botName, character)
		.catch((error) => {
			console.error("[character]", error);
			return character;
		})
		.finally(() => filling.delete(guildId));
	filling.set(guildId, next);
	return next;
}
