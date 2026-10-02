import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
} from "discord.js";
import { QueueRepeatMode, useQueue } from "discord-player";
import { skipCurrent } from "#/features/music/skip";

const CONTROL_ID_PREFIX = "np:";

export const isControlButton = (customId: string) =>
	customId.startsWith(CONTROL_ID_PREFIX);

export function controlButtons() {
	const button = (action: string, label: string) =>
		new ButtonBuilder()
			.setCustomId(`${CONTROL_ID_PREFIX}${action}`)
			.setLabel(label)
			.setStyle(ButtonStyle.Secondary);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		button("toggle", "⏯️"),
		button("skip", "⏭️"),
		button("loop", "🔁"),
		button("stop", "⏹️"),
	);
}

const reject = (interaction: ButtonInteraction, content: string) =>
	interaction.reply({ content, flags: MessageFlags.Ephemeral });

export async function handleControl(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild()) return;

	const queue = useQueue(interaction.guild);
	if (!queue?.currentTrack) {
		await reject(interaction, "Nothing is playing right now.");
		return;
	}
	if (interaction.member.voice.channelId !== queue.channel?.id) {
		await reject(interaction, "You need to be in my voice channel to do that!");
		return;
	}

	const action = interaction.customId.slice(CONTROL_ID_PREFIX.length);
	let reply: string;

	switch (action) {
		case "toggle": {
			const paused = queue.node.isPaused();
			queue.node.setPaused(!paused);
			reply = paused ? "▶️ Resumed." : "⏸️ Paused.";
			break;
		}
		case "skip":
			skipCurrent(queue);
			reply = "⏭️ Skipped.";
			break;
		case "loop": {
			const next =
				queue.repeatMode === QueueRepeatMode.OFF
					? QueueRepeatMode.TRACK
					: queue.repeatMode === QueueRepeatMode.TRACK
						? QueueRepeatMode.QUEUE
						: QueueRepeatMode.OFF;
			queue.setRepeatMode(next);
			reply = [
				"🔁 Loop is off.",
				"🔂 Looping the track.",
				"🔁 Looping the queue.",
			][
				next === QueueRepeatMode.OFF
					? 0
					: next === QueueRepeatMode.TRACK
						? 1
						: 2
			] as string;
			break;
		}
		case "stop":
			queue.delete();
			reply = "⏹️ Stopped the music and cleared the queue.";
			break;
		default:
			return;
	}

	await interaction.reply({ content: reply });
}
