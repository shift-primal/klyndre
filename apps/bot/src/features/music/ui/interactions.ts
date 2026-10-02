import { type Client, Events } from "discord.js";
import { handleControl, isControlButton } from "#/features/music/ui/controls";
import { handleQueuePage, isQueueButton } from "#/features/music/ui/queue";

export function registerMusicButtons(client: Client) {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;
		try {
			if (isControlButton(interaction.customId)) {
				await handleControl(interaction);
			} else if (isQueueButton(interaction.customId)) {
				await handleQueuePage(interaction);
			}
		} catch (error) {
			console.error("[music button]", error);
		}
	});
}
