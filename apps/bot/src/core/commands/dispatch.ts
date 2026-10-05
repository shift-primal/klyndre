import { getSettings } from "@klyndre/config";
import { type Client, Events, MessageFlags } from "discord.js";
import { refusal } from "#/core/commands/guards";
import type { CommandRegistry } from "#/core/commands/registry";
import type { Command, CommandContext } from "#/core/commands/types";

async function run(command: Command, ctx: CommandContext) {
	try {
		const refused = await refusal(command, ctx);
		if (refused) return await ctx.reply(refused, { ephemeral: true });
		await command.run(ctx);
	} catch (error) {
		console.error(`[command ${command.name}]`, error);
		await ctx.reply("Something went wrong.").catch(() => {});
	}
}

const parsePrefixed = (content: string, prefix: string) => {
	if (!content.startsWith(prefix)) return null;
	const match = /^(\S+)\s*([\s\S]*)$/.exec(content.slice(prefix.length));
	return match?.[1] ? { name: match[1], args: match[2] ?? "" } : null;
};

export function registerDispatch(client: Client, registry: CommandRegistry) {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) {
			return;
		}
		const command = registry.find(interaction.commandName);
		if (!command) return;

		await run(command, {
			guild: interaction.guild,
			member: interaction.member,
			channel: interaction.channel,
			args: (command.arguments ?? [])
				.map((arg) => interaction.options.getString(arg.name) ?? "")
				.filter(Boolean)
				.join(" "),
			defer: async () => {
				await interaction.deferReply();
			},
			reply: async (content, options) => {
				const { components, ephemeral } = options ?? {};
				if (interaction.deferred && !interaction.replied) {
					await interaction.editReply({ content, components });
				} else if (interaction.replied) {
					await interaction.followUp({
						content,
						components,
						flags: ephemeral ? MessageFlags.Ephemeral : undefined,
					});
				} else {
					await interaction.reply({
						content,
						components,
						flags: ephemeral ? MessageFlags.Ephemeral : undefined,
					});
				}
			},
		});
	});

	client.on(Events.MessageCreate, async (message) => {
		if (message.author.bot || !message.inGuild() || !message.member) return;

		const { prefix } = await getSettings(message.guildId, "commands");
		const parsed = parsePrefixed(message.content, prefix);
		if (!parsed) return;

		const command = registry.find(parsed.name);
		if (!command || command.slashOnly) return;

		await run(command, {
			guild: message.guild,
			member: message.member,
			channel: message.channel,
			args: parsed.args,
			defer: async () => {
				await message.channel.sendTyping();
			},
			reply: async (content, options) => {
				await message.reply({ content, components: options?.components });
			},
		});
	});
}
