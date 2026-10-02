import type { Command } from "#/core/commands/types";
import { refuse, requireQueue } from "#/features/music/access";
import { renderQueue } from "#/features/music/ui/queue";

export const queue: Command = {
	name: "queue",
	aliases: ["q"],
	description: "Show the current queue",
	argument: { name: "page", description: "Page number" },
	async run(ctx) {
		const activeQueue = await requireQueue(ctx, { sameChannel: false });
		if (!activeQueue) return;

		const page = ctx.args ? Number(ctx.args) : 1;
		if (!Number.isInteger(page)) {
			return refuse(ctx, "The page must be a number.");
		}

		const { content, components } = renderQueue(activeQueue, page);
		await ctx.reply(content, { components });
	},
};
