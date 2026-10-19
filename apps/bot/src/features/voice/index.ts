import { type Client, Events, type VoiceState } from "discord.js";
import { useMainPlayer } from "discord-player";

import type { Feature } from "#/core/feature";
import { voiceCommands } from "#/features/voice/commands";
import { keepConnectionThroughMusic, sessions } from "#/features/voice/session";

function onVoiceState(client: Client, before: VoiceState, after: VoiceState) {
	const session = sessions.get(after.guild.id);
	if (!session) return;

	if (after.id === client.user?.id) {
		if (!after.channelId) {
			void session.end("disconnected from voice");
			return;
		}
		// moved by someone: carry on in the new channel
		if (after.channel && after.channelId !== session.channel.id) {
			session.channel = after.channel;
		}
	}

	const callId = session.channel.id;
	if (before.channelId === callId || after.channelId === callId) {
		session.checkAlone();
		void session
			.refreshInstructions()
			.catch((error) =>
				console.error("[voice] couldn't refresh the prompt", error),
			);
	}
}

export const voice: Feature = {
	name: "voice",
	description: "Talk with the AI out loud in a voice channel",
	commands: voiceCommands,
	register(client) {
		client.on(Events.VoiceStateUpdate, (before, after) =>
			onVoiceState(client, before, after),
		);
		// after the music player exists, which the music feature sets up first
		useMainPlayer().events.on("connection", keepConnectionThroughMusic);
	},
};
