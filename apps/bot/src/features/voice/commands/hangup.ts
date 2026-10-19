import type { Command } from "#/core/commands/types";
import { refuse } from "#/features/music/access";
import { sessions } from "#/features/voice/session";

export const hangup: Command = {
	name: "hangup",
	aliases: ["bye"],
	description: "Stop talking in voice. Music, if any, keeps playing",
	async run(ctx) {
		const session = sessions.get(ctx.guild.id);
		if (!session) {
			await refuse(ctx, "I'm not talking in a voice channel.");
			return;
		}
		if (ctx.member.voice.channelId !== session.channel.id) {
			await refuse(ctx, "You need to be in the call to hang me up.");
			return;
		}
		await session.end(`hung up by ${ctx.member.displayName}`);
		await ctx.reply("👋 Hung up.");
	},
};
