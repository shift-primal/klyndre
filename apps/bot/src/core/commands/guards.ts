import { getSettings } from "@klyndre/config";
import { type GuildMember, PermissionFlagsBits } from "discord.js";
import type { Command, CommandContext } from "#/core/commands/types";

// admins always count, so dev commands still work before a dev role is set
export async function isDev(member: GuildMember) {
	if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
	const { devRoleId } = await getSettings(member.guild.id, "commands");
	return devRoleId !== null && member.roles.cache.has(devRoleId);
}

async function devRefusal(ctx: CommandContext) {
	const { devRoleId } = await getSettings(ctx.guild.id, "commands");
	const role = devRoleId && ctx.guild.roles.cache.get(devRoleId);
	return role
		? `Only the **${role.name}** role can use that.`
		: "Only admins can use that.";
}

export async function refusal(
	command: Command,
	ctx: CommandContext,
): Promise<string | null> {
	if (command.devOnly && !(await isDev(ctx.member))) return devRefusal(ctx);
	return null;
}
