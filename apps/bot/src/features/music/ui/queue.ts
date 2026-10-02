import { getSettings } from "@klyndre/config";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
} from "discord.js";
import { type GuildQueue, useQueue } from "discord-player";
import { formatNowPlaying, formatTrack } from "#/features/music/ui/format";

const QUEUE_ID_PREFIX = "q";

export const isQueueButton = (customId: string) => /^q\d+:/.test(customId);

export function renderQueue(
	queue: GuildQueue,
	pageSize: number,
	requestedPage = 1,
) {
	const upcoming = queue.tracks.toArray();
	const pages = Math.max(1, Math.ceil(upcoming.length / pageSize));
	const page = Math.min(Math.max(requestedPage, 1), pages);
	const start = (page - 1) * pageSize;

	const lines = [];
	if (queue.currentTrack) lines.push(formatNowPlaying(queue.currentTrack), "");

	if (upcoming.length === 0) {
		lines.push("The queue is empty.");
	} else {
		lines.push("**Up next:**");
		for (const [i, track] of upcoming
			.slice(start, start + pageSize)
			.entries()) {
			lines.push(`${start + i + 1}. ${formatTrack(track)}`);
		}
	}
	if (pages > 1) {
		lines.push(`-# Page ${page}/${pages} · ${upcoming.length} tracks`);
	}

	return {
		content: lines.join("\n"),
		components: pages > 1 ? [pageButtons(page, pages)] : [],
	};
}

function pageButtons(page: number, pages: number) {
	const button = (
		slot: string,
		target: number,
		label: string,
		disabled: boolean,
	) =>
		new ButtonBuilder()
			.setCustomId(`${QUEUE_ID_PREFIX}${target}:${slot}`)
			.setLabel(label)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		button("first", 1, "⏮️", page === 1),
		button("prev", page - 1, "◀️ Prev", page === 1),
		button("next", page + 1, "Next ▶️", page === pages),
		button("last", pages, "⏭️", page === pages),
	);
}

export async function handleQueuePage(interaction: ButtonInteraction) {
	const page = Number(
		interaction.customId.slice(QUEUE_ID_PREFIX.length).split(":")[0],
	);
	if (!Number.isInteger(page) || !interaction.inCachedGuild()) return;

	const queue = useQueue(interaction.guild);
	if (!queue) {
		await interaction.update({
			content: "The queue is gone.",
			components: [],
		});
		return;
	}

	const { queuePageSize } = await getSettings(interaction.guildId, "music");
	await interaction.update(renderQueue(queue, queuePageSize, page));
}
