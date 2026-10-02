import { db, promptPresets } from "@klyndre/db";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	adminMiddleware,
	authMiddleware,
} from "#/features/auth/server/auth-middleware";
import { kindInput } from "#/features/prompts/lib/prompt-kinds";

export const listPresets = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(kindInput)
	.handler(({ data }) =>
		db
			.select()
			.from(promptPresets)
			.where(eq(promptPresets.kind, data.kind))
			.orderBy(desc(promptPresets.updatedAt)),
	);

// saving under an existing name overwrites that preset
export const savePreset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(
		kindInput.extend({
			name: z.string().trim().min(1).max(80),
			content: z.string().min(1).max(20_000),
		}),
	)
	.handler(async ({ data }) => {
		const [preset] = await db
			.insert(promptPresets)
			.values(data)
			.onConflictDoUpdate({
				target: [promptPresets.kind, promptPresets.name],
				set: { content: data.content, updatedAt: new Date() },
			})
			.returning();
		return preset;
	});

export const deletePreset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(z.object({ id: z.number().int() }))
	.handler(async ({ data }) => {
		await db.delete(promptPresets).where(eq(promptPresets.id, data.id));
	});
