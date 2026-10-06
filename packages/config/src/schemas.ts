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

const isTimeZone = (name: string) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: name });
		return true;
	} catch {
		return false;
	}
};
const timeZone = z.string().refine(isTimeZone, "Unknown time zone");

export const chatSettings = z.object({
	model: field(z.string().min(1), d.chat.model),
	randomReplyChance: field(chance, d.chat.randomReplyChance),
	historyLimit: field(z.int().min(1).max(100), d.chat.historyLimit),
	laterLimit: field(z.int().min(0).max(100), d.chat.laterLimit),
	threadLimit: field(z.int().min(0).max(50), d.chat.threadLimit),
	maxImages: field(count, d.chat.maxImages),
	imageMaxAgeMs: field(count, d.chat.imageMaxAgeMs),
	maxReplyTokens: field(z.int().min(16).max(4000), d.chat.maxReplyTokens),
	singleLineReplies: field(z.boolean(), d.chat.singleLineReplies),
	lowercaseReplies: field(z.boolean(), d.chat.lowercaseReplies),
	stripEmojis: field(z.boolean(), d.chat.stripEmojis),
	turnWaitLimitMs: field(count, d.chat.turnWaitLimitMs),
	timeZone: field(timeZone, d.chat.timeZone),
	profilesEnabled: field(z.boolean(), d.chat.profilesEnabled),
	profileUpdateEvery: field(z.int().min(1), d.chat.profileUpdateEvery),
	openerMemory: field(z.int().min(0).max(20), d.chat.openerMemory),
	openerRepeatLimit: field(count, d.chat.openerRepeatLimit),
	skipMaxWords: field(z.int().min(0).max(50), d.chat.skipMaxWords),
	quietTypingMs: field(z.int().min(0).max(10_000), d.chat.quietTypingMs),
	loreEnabled: field(z.boolean(), d.chat.loreEnabled),
	loreShown: field(z.int().min(0).max(30), d.chat.loreShown),
	loreRandomFill: field(z.int().min(0).max(10), d.chat.loreRandomFill),
	loreCooldownReplies: field(count, d.chat.loreCooldownReplies),
	loreUpdateEvery: field(z.int().min(1), d.chat.loreUpdateEvery),
	loreMaxEntries: field(z.int().min(1), d.chat.loreMaxEntries),
	loreMaxNewPerUpdate: field(count, d.chat.loreMaxNewPerUpdate),
	loreKeyWordLength: field(z.int().min(1).max(20), d.chat.loreKeyWordLength),
	loreNoteWordLength: field(z.int().min(1).max(20), d.chat.loreNoteWordLength),
	loreRareWordLimit: field(z.int().min(1), d.chat.loreRareWordLimit),
	loreEvidenceWords: field(z.int().min(1).max(20), d.chat.loreEvidenceWords),
	loreUpdateContext: field(count, d.chat.loreUpdateContext),
});

export const channelsSettings = z.object({
	aiChannelIds: field(ids, d.channels.aiChannelIds),
	randomReplyChannelIds: field(ids, d.channels.randomReplyChannelIds),
	musicChannelIds: field(ids, d.channels.musicChannelIds),
});

export const personalitySettings = z.object({
	persona: field(z.string(), d.personality.persona),
	rules: field(z.string(), d.personality.rules),
	format: field(z.string(), d.personality.format),
	peopleGuidance: field(z.string(), d.personality.peopleGuidance),
	profileInstructions: field(
		z.string().min(1),
		d.personality.profileInstructions,
	),
	selfLoreGuidance: field(z.string(), d.personality.selfLoreGuidance),
	serverLoreGuidance: field(z.string(), d.personality.serverLoreGuidance),
	loreInstructions: field(z.string().min(1), d.personality.loreInstructions),
	repeatedOpenerNote: field(z.string(), d.personality.repeatedOpenerNote),
	skipNote: field(z.string(), d.personality.skipNote),
	skipMarker: field(z.string(), d.personality.skipMarker),
	fallbackReply: field(z.string(), d.personality.fallbackReply),
	contentFilterReply: field(z.string(), d.personality.contentFilterReply),
	answeringMarker: field(z.string(), d.personality.answeringMarker),
	replyLabel: field(z.string(), d.personality.replyLabel),
});

export const commandsSettings = z.object({
	prefix: field(z.string().min(1), d.commands.prefix),
	devRoleId: field(z.string().nullable(), d.commands.devRoleId),
});

export const musicSettings = z.object({
	leaveOnEmpty: field(z.boolean(), d.music.leaveOnEmpty),
	leaveOnEmptyMs: field(count, d.music.leaveOnEmptyMs),
	leaveOnEnd: field(z.boolean(), d.music.leaveOnEnd),
	leaveOnEndMs: field(count, d.music.leaveOnEndMs),
	leaveOnStop: field(z.boolean(), d.music.leaveOnStop),
	restoreWindowMs: field(count, d.music.restoreWindowMs),
	maxTrackRetries: field(count, d.music.maxTrackRetries),
	queuePageSize: field(z.int().min(1).max(25), d.music.queuePageSize),
	lagLogMs: field(count, d.music.lagLogMs),
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
