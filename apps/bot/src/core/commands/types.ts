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
	// prefix commands get the raw text after the name, slash options are joined with spaces
	arguments?: CommandArgument[];
	slashOnly?: boolean;
	anyChannel?: boolean;
	// only the dev role (commands.devRoleId) and admins may run it
	devOnly?: boolean;
	run(ctx: CommandContext): Promise<void>;
}
