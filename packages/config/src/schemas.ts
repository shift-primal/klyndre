import { z } from "zod";

import { defaults as d } from "./defaults";
import type { Meta } from "./meta";

const field = <T extends z.ZodType>(type: T, m: Meta<z.output<T>>) =>
	type.default(m.default as never).meta({
		description: m.description,
		...(m.widget && { widget: m.widget }),
		...(m.advanced && { advanced: true }),
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

export const replyLengths = ["short", "normal", "long"] as const;
export type ReplyLength = (typeof replyLengths)[number];

export const identitySettings = z.object({
	persona: field(z.string(), d.identity.persona),
	behaviour: field(z.string(), d.identity.behaviour),
	makeUpBlanks: field(z.boolean(), d.identity.makeUpBlanks),
	learnFromChat: field(z.boolean(), d.identity.learnFromChat),
	quirksShown: field(z.int().min(0).max(20), d.identity.quirksShown),
	storiesShown: field(z.int().min(0).max(5), d.identity.storiesShown),
	selfWords: field(z.array(z.string()), d.identity.selfWords),
	characterEvidenceWords: field(
		z.int().min(1).max(20),
		d.identity.characterEvidenceWords,
	),
});

export const styleSettings = z.object({
	language: field(z.string(), d.style.language),
	replyLength: field(z.enum(replyLengths), d.style.replyLength),
	lowercaseReplies: field(z.boolean(), d.style.lowercaseReplies),
	stripEmojis: field(z.boolean(), d.style.stripEmojis),
	maxMessages: field(z.int().min(1).max(10), d.style.maxMessages),
	multiMessageChance: field(chance, d.style.multiMessageChance),
	styleNotes: field(z.string(), d.style.styleNotes),
	followUpTypingMs: field(z.int().min(0).max(500), d.style.followUpTypingMs),
});

export const repliesSettings = z.object({
	aiChannelIds: field(ids, d.replies.aiChannelIds),
	randomReplyChannelIds: field(ids, d.replies.randomReplyChannelIds),
	starterChannelIds: field(ids, d.replies.starterChannelIds),
	replyToMentionsAnywhere: field(
		z.boolean(),
		d.replies.replyToMentionsAnywhere,
	),
	randomReplyChance: field(chance, d.replies.randomReplyChance),
	starterQuietMs: field(count, d.replies.starterQuietMs),
	starterMaxPerDay: field(count, d.replies.starterMaxPerDay),
	model: field(z.string().min(1), d.replies.model),
	temperature: field(z.number().min(0).max(2), d.replies.temperature),
	candidates: field(z.int().min(1).max(8), d.replies.candidates),
	fallbackReply: field(z.string(), d.replies.fallbackReply),
	contentFilterReply: field(z.string(), d.replies.contentFilterReply),
	notHereReply: field(z.string(), d.replies.notHereReply),
	historyLimit: field(z.int().min(1).max(100), d.replies.historyLimit),
	laterLimit: field(z.int().min(0).max(100), d.replies.laterLimit),
	threadLimit: field(z.int().min(0).max(50), d.replies.threadLimit),
	maxImages: field(count, d.replies.maxImages),
	imageMaxAgeMs: field(count, d.replies.imageMaxAgeMs),
	maxReplyTokens: field(z.int().min(16).max(4000), d.replies.maxReplyTokens),
	turnWaitLimitMs: field(count, d.replies.turnWaitLimitMs),
	timeZone: field(timeZone, d.replies.timeZone),
});

export const memorySettings = z.object({
	profilesEnabled: field(z.boolean(), d.memory.profilesEnabled),
	loreEnabled: field(z.boolean(), d.memory.loreEnabled),
	loreShown: field(z.int().min(0).max(30), d.memory.loreShown),
	loreCooldownReplies: field(count, d.memory.loreCooldownReplies),
	profileUpdateEvery: field(z.int().min(1), d.memory.profileUpdateEvery),
	profileEvidenceWords: field(
		z.int().min(1).max(20),
		d.memory.profileEvidenceWords,
	),
	loreUpdateEvery: field(z.int().min(1), d.memory.loreUpdateEvery),
	loreMaxEntries: field(z.int().min(1), d.memory.loreMaxEntries),
	loreMaxNewPerUpdate: field(count, d.memory.loreMaxNewPerUpdate),
	loreKeyWordLength: field(z.int().min(1).max(20), d.memory.loreKeyWordLength),
	loreNoteWordLength: field(
		z.int().min(1).max(20),
		d.memory.loreNoteWordLength,
	),
	loreRareWordLimit: field(z.int().min(1), d.memory.loreRareWordLimit),
	loreEvidenceWords: field(z.int().min(1).max(20), d.memory.loreEvidenceWords),
	loreUpdateContext: field(count, d.memory.loreUpdateContext),
});

export const internalsSettings = z.object({
	characterGuidance: field(z.string(), d.internals.characterGuidance),
	storiesGuidance: field(z.string(), d.internals.storiesGuidance),
	peopleGuidance: field(z.string(), d.internals.peopleGuidance),
	serverLoreGuidance: field(z.string(), d.internals.serverLoreGuidance),
	fillInstructions: field(z.string().min(1), d.internals.fillInstructions),
	characterInstructions: field(
		z.string().min(1),
		d.internals.characterInstructions,
	),
	profileInstructions: field(
		z.string().min(1),
		d.internals.profileInstructions,
	),
	loreInstructions: field(z.string().min(1), d.internals.loreInstructions),
	judgeInstructions: field(z.string().min(1), d.internals.judgeInstructions),
	starterNote: field(z.string().min(1), d.internals.starterNote),
	answeringMarker: field(z.string(), d.internals.answeringMarker),
	replyLabel: field(z.string(), d.internals.replyLabel),
});

export const commandsSettings = z.object({
	prefix: field(z.string().min(1), d.commands.prefix),
	devRoleId: field(z.string().nullable(), d.commands.devRoleId),
});

export const musicSettings = z.object({
	musicChannelIds: field(ids, d.music.musicChannelIds),
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
	identity: identitySettings,
	style: styleSettings,
	replies: repliesSettings,
	memory: memorySettings,
	music: musicSettings,
	commands: commandsSettings,
	internals: internalsSettings,
} as const;

export type ModuleName = keyof typeof moduleSchemas;

export type Settings<M extends ModuleName> = z.output<
	(typeof moduleSchemas)[M]
>;

export type SettingsInput<M extends ModuleName> = z.input<
	(typeof moduleSchemas)[M]
>;
