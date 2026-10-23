import type {
	ActionRowBuilder,
	Guild,
	GuildMember,
	MessageActionRowComponentBuilder,
	TextBasedChannel,
} from "discord.js";

export interface ReplyOptions {
	ephemeral?: boolean;
	components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface CommandContext {
	guild: Guild;
	member: GuildMember;
	channel: TextBasedChannel | null;
	args: string;
	defer(): Promise<void>;
	reply(content: string, options?: ReplyOptions): Promise<void>;
	dismiss(): Promise<void>;
}

export interface CommandArgument {
	name: string;
	description: string;
	required?: boolean;
}

export interface Command {
	name: string;
	aliases?: string[];
	description: string;
	arguments?: CommandArgument[];
	slashOnly?: boolean;
	anyChannel?: boolean;
	devOnly?: boolean;
	run(ctx: CommandContext): Promise<void>;
}
