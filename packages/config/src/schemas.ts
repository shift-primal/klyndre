import { z } from "zod";
import { defaults as d } from "./defaults";
import type { Meta } from "./meta";

// Only structure lives here, default values and descriptions are in defaults.ts

const field = <T extends z.ZodType>(type: T, m: Meta<z.output<T>>) =>
	type.default(m.default as never).meta({
		description: m.description,
		...(m.widget && { widget: m.widget }),
	});

const chance = z.number().min(0).max(1);
const count = z.int().min(0);
const ids = z.array(z.string());

export const chatSettings = z.object({
	model: field(z.string().min(1), d.chat.model),
	randomReplyChance: field(chance, d.chat.randomReplyChance),
	historyLimit: field(z.int().min(1).max(100), d.chat.historyLimit),
	maxImages: field(count, d.chat.maxImages),
	profileUpdateEvery: field(z.int().min(1), d.chat.profileUpdateEvery),
});

export const channelsSettings = z.object({
	aiChannelIds: field(ids, d.channels.aiChannelIds),
	randomReplyChannelIds: field(ids, d.channels.randomReplyChannelIds),
	musicChannelIds: field(ids, d.channels.musicChannelIds),
});

export const personalitySettings = z.object({
	persona: field(z.string(), d.personality.persona),
	rules: field(z.string(), d.personality.rules),
});

export const commandsSettings = z.object({
	prefix: field(z.string().min(1), d.commands.prefix),
	devRoleId: field(z.string().nullable(), d.commands.devRoleId),
});

export const musicSettings = z.object({
	leaveOnEmptyMs: field(count, d.music.leaveOnEmptyMs),
	leaveOnEndMs: field(count, d.music.leaveOnEndMs),
	maxTrackRetries: field(count, d.music.maxTrackRetries),
	queuePageSize: field(z.int().min(1).max(25), d.music.queuePageSize),
});

export const moduleSchemas = {
	chat: chatSettings,
	channels: channelsSettings,
	personality: personalitySettings,
	commands: commandsSettings,
	music: musicSettings,
} as const;

export type ModuleName = keyof typeof moduleSchemas;

export type Settings<M extends ModuleName> = z.output<
	(typeof moduleSchemas)[M]
>;

export type SettingsInput<M extends ModuleName> = z.input<
	(typeof moduleSchemas)[M]
>;
