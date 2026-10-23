import { PermissionFlagsBits } from "discord.js";

import type { Command } from "#/core/commands/types";
import { refuse } from "#/features/music/access";
import { sessions, VoiceSession } from "#/features/voice/session";

export const talk: Command = {
	name: "talk",
	aliases: ["join", "vc"],
	description: "Join your voice channel and talk with the AI out loud",
	async run(ctx) {
		const channel = ctx.member.voice.channel;
		if (!channel) {
			await refuse(ctx, "Join a voice channel first, then I'll hop in.");
			return;
		}
		const current = ctx.guild.members.me?.voice.channel;
		if (current && current.id !== channel.id) {
			await refuse(ctx, `I'm already in ${current.toString()}.`);
			return;
		}
		if (sessions.has(ctx.guild.id)) {
			await refuse(ctx, "I'm already talking in here.");
			return;
		}
		const me = ctx.guild.members.me;
		const canSpeak =
			me && channel.permissionsFor(me).has(PermissionFlagsBits.Speak);
		if (!channel.joinable || !canSpeak) {
			await refuse(ctx, "I'm not allowed to join or speak in that channel.");
			return;
		}

		await ctx.defer();
		try {
			await VoiceSession.start(channel, ctx.channel);
			await ctx.reply(
				`🎙️ Joined ${channel.toString()}. Talk to me, and use \`hangup\` when you're done.`,
			);
		} catch (error) {
			console.error("[voice]", error);
			await ctx.reply("I couldn't join the voice channel.");
		}
	},
};
