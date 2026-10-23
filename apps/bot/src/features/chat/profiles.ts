import { getSettings } from "@klyndre/config";
import { db, profiles } from "@klyndre/db";
import { generateText, type ModelMessage, Output } from "ai";
import type { Message } from "discord.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { chatModel } from "#/features/chat/model";
import { botNameOf } from "#/features/chat/prompt";
import { withoutImages } from "#/features/chat/reply";
import { linesBy, quotedFrom, transcriptOf } from "#/features/chat/transcript";

export type People = Map<string, string>;

export async function loadNotes(guildId: string, people: People) {
	if (people.size === 0) return new Map<string, string>();

	const rows = await db
		.select({ userId: profiles.userId, notes: profiles.notes })
		.from(profiles)
		.where(
			and(
				eq(profiles.guildId, guildId),
				inArray(profiles.userId, [...people.keys()]),
			),
		);
	return new Map(rows.map((row) => [row.userId, row.notes]));
}

export async function clearNotes(guildId: string, userId: string) {
	const removed = await db
		.delete(profiles)
		.where(and(eq(profiles.guildId, guildId), eq(profiles.userId, userId)))
		.returning({ userId: profiles.userId });
	return removed.length > 0;
}

const subjects = [
	"themselves",
	"their own family or friends",
	"the bot",
	"someone else in the chat",
	"the group",
] as const;
const ownSubjects = new Set<string>(subjects.slice(0, 2));

const updateSchema = z.object({
	people: z.array(
		z.object({
			userId: z.string(),
			facts: z.array(
				z.object({
					quote: z
						.string()
						.describe(
							"Words copied exactly from this person's own lines that the fact comes from",
						),
					about: z
						.enum(subjects)
						.describe(
							'Who the quote is about. "you" or "your" in a line aimed at the bot is the bot',
						),
					fact: z.string(),
				}),
			),
			notes: z
				.string()
				.describe(
					"The person's full updated notes, the old ones that still hold plus the new facts about them",
				),
		}),
	),
});
type Update = z.infer<typeof updateSchema>["people"][number];

export async function draftNotes(
	guildId: string,
	botName: string,
	people: People,
	history: ModelMessage[],
) {
	const [{ model }, { profileEvidenceWords }, { profileInstructions }, notes] =
		await Promise.all([
			getSettings(guildId, "replies"),
			getSettings(guildId, "memory"),
			getSettings(guildId, "internals"),
			loadNotes(guildId, people),
		]);
	const current = [...people]
		.map(
			([id, name]) => `${id} (${name}): ${notes.get(id) ?? "(no notes yet)"}`,
		)
		.join("\n");

	const { output } = await generateText({
		model: chatModel(model),
		instructions: `${profileInstructions}\n\n## Current notes\n${current}`,
		messages: [
			{
				role: "user",
				content: `## Chat\n${transcriptOf(withoutImages(history), botName)}`,
			},
		],
		output: Output.object({ schema: updateSchema }),
	});

	const backedUp = ({ userId, facts }: Update, name: string) => {
		const lines = linesBy(history, name);
		const kept = facts.filter(
			({ quote, about }) =>
				ownSubjects.has(about) &&
				quotedFrom(quote, lines, profileEvidenceWords),
		);
		for (const { fact, about } of facts.filter((f) => !kept.includes(f))) {
			console.log(
				`[profiles] dropped for ${name} (${userId}): ${fact} [${about}]`,
			);
		}
		return kept.length > 0;
	};

	return output.people.flatMap((update) => {
		const name = people.get(update.userId);
		const updated = update.notes.trim();
		return name && updated && backedUp(update, name)
			? [{ guildId, userId: update.userId, name, notes: updated }]
			: [];
	});
}

const repliesSinceUpdate = new Map<string, number>();
const updating = new Set<string>();

export async function maybeUpdateNotes(
	message: Message<true>,
	people: People,
	history: ModelMessage[],
) {
	const { channelId, guildId } = message;
	const { profilesEnabled, profileUpdateEvery } = await getSettings(
		guildId,
		"memory",
	);
	if (!profilesEnabled) return;

	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	if (
		count < profileUpdateEvery ||
		updating.has(channelId) ||
		people.size === 0
	) {
		return;
	}
	repliesSinceUpdate.set(channelId, 0);
	updating.add(channelId);

	try {
		const rows = await draftNotes(guildId, botNameOf(message), people, history);
		for (const { name, notes } of rows) {
			console.log(`[profiles] ~ ${name}: ${notes}`);
		}
		if (rows.length === 0) return;

		await db
			.insert(profiles)
			.values(rows)
			.onConflictDoUpdate({
				target: [profiles.guildId, profiles.userId],
				set: {
					name: sql`excluded.name`,
					notes: sql`excluded.notes`,
					updatedAt: new Date(),
				},
			});
	} catch (error) {
		console.error("[profiles]", error);
	} finally {
		updating.delete(channelId);
	}
}
