import { getSettings } from "@klyndre/config";
import { PermissionsBitField, type VoiceBasedChannel } from "discord.js";
import { type GuildQueue, type Track, useQueue } from "discord-player";

import type { Command, CommandContext } from "#/core/commands/types";
import { findTrack } from "#/features/music/find-track";

type ActiveQueue = GuildQueue & { currentTrack: Track };

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
	if (sameChannel && !(await requireSameChannel(ctx, queue))) return null;
	return queue as ActiveQueue;
}

// a queue exists from the moment /play starts it, but currentTrack stays null
// until a track's audio has loaded, so while the first track is loading (or
// failing and being retried) requireQueue doesn't see it. For stopping it anyway
export async function requireAnyQueue(
	ctx: CommandContext,
): Promise<GuildQueue | null> {
	const queue = useQueue(ctx.guild);

	if (!queue) {
		await refuse(ctx, "Nothing is playing right now.");
		return null;
	}
	if (!(await requireSameChannel(ctx, queue))) return null;
	return queue;
}

async function requireSameChannel(ctx: CommandContext, queue: GuildQueue) {
	if (ctx.member.voice.channelId === queue.channel?.id) return true;
	await refuse(ctx, "You need to be in my voice channel to do that!");
	return false;
}

export async function requireUpcomingTrack(
	ctx: CommandContext,
	queue: ActiveQueue,
	action: string,
	input = ctx.args,
): Promise<{ track: Track; position: number } | null> {
	const upcoming = queue.tracks.toArray();
	if (upcoming.length === 0) {
		await refuse(ctx, `There is nothing queued to ${action}.`);
		return null;
	}

	const track = findTrack(upcoming, input);
	if (!track) {
		await refuse(
			ctx,
			`No track in the queue matches "${input}". Use its number from the queue command, or part of its title.`,
		);
		return null;
	}

	return { track, position: upcoming.indexOf(track) + 1 };
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
		const { musicChannelIds } = await getSettings(ctx.guild.id, "music");
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
