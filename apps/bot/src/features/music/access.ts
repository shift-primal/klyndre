import { getSettings } from "@klyndre/config";
import { PermissionsBitField, type VoiceBasedChannel } from "discord.js";
import { type GuildQueue, type Track, useQueue } from "discord-player";
import type { Command, CommandContext } from "#/core/commands/types";

export type ActiveQueue = GuildQueue & { currentTrack: Track };

export const refuse = (ctx: CommandContext, message: string) =>
	ctx.reply(message, { ephemeral: true });

export async function requireQueue(
	ctx: CommandContext,
	{ sameChannel = true } = {},
): Promise<ActiveQueue | null> {
	const queue = useQueue(ctx.guild);

	if (!queue?.currentTrack) {
		await refuse(ctx, "Nothing is playing right now.");
		return null;
	}
	if (sameChannel && ctx.member.voice.channelId !== queue.channel?.id) {
		await refuse(ctx, "You need to be in my voice channel to do that!");
		return null;
	}
	return queue as ActiveQueue;
}

export async function requireVoiceChannel(
	ctx: CommandContext,
): Promise<VoiceBasedChannel | null> {
	const voiceChannel = ctx.member.voice.channel;
	if (!voiceChannel) {
		await refuse(ctx, "You need to be in a voice channel to play music!");
		return null;
	}

	const me = ctx.guild.members.me;
	if (me?.voice.channel && me.voice.channel !== voiceChannel) {
		await refuse(ctx, "I am already playing in a different voice channel!");
		return null;
	}

	const permissions = me && voiceChannel.permissionsFor(me);
	const canPlay = permissions?.has([
		PermissionsBitField.Flags.Connect,
		PermissionsBitField.Flags.Speak,
	]);
	if (!canPlay) {
		await refuse(
			ctx,
			"I need permission to connect and speak in your voice channel!",
		);
		return null;
	}

	return voiceChannel;
}

export const withMusicChannel = (command: Command): Command => ({
	...command,
	async run(ctx) {
		const { musicChannelIds } = await getSettings(ctx.guild.id, "channels");
		const here = ctx.channel?.id;

		if (
			musicChannelIds.length > 0 &&
			!(here && musicChannelIds.includes(here))
		) {
			const where = musicChannelIds.map((id) => `<#${id}>`).join(", ");
			await refuse(ctx, `Music commands only work in ${where}.`);
			return;
		}
		await command.run(ctx);
	},
});
