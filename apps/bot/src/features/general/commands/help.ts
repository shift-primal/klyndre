import { getSettings } from "@klyndre/config";
import type { Command } from "#/core/commands/types";
import type { Feature } from "#/core/feature";
import { chunk, formatArguments } from "#/lib/utils/text";

const MESSAGE_LIMIT = 2000;

const title = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function usage(command: Command) {
	if (command.slashOnly) return `**/${command.name}**`;
	const args = command.arguments?.length
		? ` \`${formatArguments(command.arguments)}\``
		: "";
	const aliases = command.aliases?.length
		? ` (${command.aliases.join(", ")})`
		: "";
	return `**${command.name}**${args}${aliases}`;
}

function overview(features: Feature[], prefix: string) {
	const sections = features
		.filter((feature) => feature.commands?.length)
		.map((feature) => {
			const names = (feature.commands ?? [])
				.map((command) => `\`${command.name}\``)
				.join(" ");
			const about = feature.description ? ` · ${feature.description}` : "";
			return `**${title(feature.name)}**${about}\n${names}`;
		});

	return [
		...sections,
		`-# \`${prefix}help music\` for a feature, \`${prefix}help play\` for one command. Every command also works as a slash command, e.g. \`/play\`.`,
	].join("\n \n");
}

function featurePage(feature: Feature) {
	const lines = (feature.commands ?? []).map(
		(command) => `${usage(command)}\n-# ${command.description}`,
	);
	const header = `**${title(feature.name)}**${feature.description ? ` · ${feature.description}` : ""}`;
	return [header, ...lines].join("\n \n");
}

function commandPage(command: Command) {
	const lines = [usage(command), command.description];
	for (const arg of command.arguments ?? []) {
		lines.push(
			`-# \`${arg.name}\`${arg.required ? "" : " (optional)"}: ${arg.description}`,
		);
	}
	return lines.join("\n");
}

export const help: Command = {
	name: "help",
	aliases: ["h", "?"],
	description: "Show help for a feature or a command",
	arguments: [
		{
			name: "topic",
			description: "A feature (music, chat, general) or a command name",
		},
	],
	anyChannel: true,
	async run(ctx) {
		// imported here, a static import would be circular (features → general → help)
		const { features } = await import("#/features");
		const topic = ctx.args.trim().toLowerCase();
		const { prefix } = await getSettings(ctx.guild.id, "commands");

		if (!topic) return ctx.reply(overview(features, prefix));

		const feature = features.find((f) => f.name === topic);
		if (feature) {
			for (const part of chunk(featurePage(feature), MESSAGE_LIMIT)) {
				await ctx.reply(part);
			}
			return;
		}

		const command = features
			.flatMap((f) => f.commands ?? [])
			.find((c) => c.name === topic || c.aliases?.includes(topic));
		if (command) return ctx.reply(commandPage(command));

		await ctx.reply(
			`There is no feature or command called "${topic}". Try \`${prefix}help\`.`,
			{ ephemeral: true },
		);
	},
};
