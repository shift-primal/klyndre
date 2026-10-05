import { getSettings } from "@klyndre/config";
import { db, profiles } from "@klyndre/db";
import { generateText, type ModelMessage, Output } from "ai";
import type { Message } from "discord.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { chatModel } from "#/features/chat/model";

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

const UPDATE_INSTRUCTIONS = `You keep short notes on the people in a Discord chat, so a chat bot can recognise them later.
Note what is specific to each person: what they talk about, habits, opinions, things they have said or done, how they write.
At most 30 words per person. Keep old notes that still hold. Only include people whose notes changed.`;

const updateSchema = z.object({
	people: z.array(z.object({ userId: z.string(), notes: z.string() })),
});

const repliesSinceUpdate = new Map<string, number>();
const updating = new Set<string>();

export async function maybeUpdateNotes(
	message: Message<true>,
	people: People,
	history: ModelMessage[],
) {
	const { channelId, guildId } = message;
	const { model, profileUpdateEvery } = await getSettings(guildId, "chat");

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
		const notes = await loadNotes(guildId, people);
		const current = [...people]
			.map(
				([id, name]) => `${id} (${name}): ${notes.get(id) ?? "(no notes yet)"}`,
			)
			.join("\n");

		const { output } = await generateText({
			model: chatModel(model),
			instructions: `${UPDATE_INSTRUCTIONS}\n\n## Current notes\n${current}`,
			messages: history,
			output: Output.object({ schema: updateSchema }),
		});

		const rows = output.people.flatMap(({ userId, notes }) => {
			const name = people.get(userId);
			return name && notes.trim()
				? [{ guildId, userId, name, notes: notes.trim() }]
				: [];
		});
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
