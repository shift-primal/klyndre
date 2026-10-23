import { z } from "zod";

import { defaults as d } from "./defaults";
import type { Meta } from "./meta";

// Only structure lives here, default values and descriptions are in defaults.ts

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

export const chatSettings = z.object({
	model: field(z.string().min(1), d.chat.model),
	temperature: field(z.number().min(0).max(2), d.chat.temperature),
	randomReplyChance: field(chance, d.chat.randomReplyChance),
	replyToMentionsAnywhere: field(z.boolean(), d.chat.replyToMentionsAnywhere),
	historyLimit: field(z.int().min(1).max(100), d.chat.historyLimit),
	laterLimit: field(z.int().min(0).max(100), d.chat.laterLimit),
	threadLimit: field(z.int().min(0).max(50), d.chat.threadLimit),
	maxImages: field(count, d.chat.maxImages),
	imageMaxAgeMs: field(count, d.chat.imageMaxAgeMs),
	maxReplyTokens: field(z.int().min(16).max(4000), d.chat.maxReplyTokens),
	maxMessages: field(z.int().min(1).max(10), d.chat.maxMessages),
	multiMessageChance: field(chance, d.chat.multiMessageChance),
	followUpTypingMs: field(z.int().min(0).max(500), d.chat.followUpTypingMs),
	lowercaseReplies: field(z.boolean(), d.chat.lowercaseReplies),
	stripEmojis: field(z.boolean(), d.chat.stripEmojis),
	turnWaitLimitMs: field(count, d.chat.turnWaitLimitMs),
	language: field(z.string(), d.chat.language),
	starterQuietMs: field(count, d.chat.starterQuietMs),
	starterMaxPerDay: field(count, d.chat.starterMaxPerDay),
	starterFromHour: field(z.int().min(0).max(23), d.chat.starterFromHour),
	starterToHour: field(z.int().min(1).max(24), d.chat.starterToHour),
	starterChance: field(chance, d.chat.starterChance),
	quirksShown: field(z.int().min(0).max(20), d.chat.quirksShown),
	timeZone: field(timeZone, d.chat.timeZone),
	profilesEnabled: field(z.boolean(), d.chat.profilesEnabled),
	profileUpdateEvery: field(z.int().min(1), d.chat.profileUpdateEvery),
	profileEvidenceWords: field(
		z.int().min(1).max(20),
		d.chat.profileEvidenceWords,
	),
	candidates: field(z.int().min(1).max(8), d.chat.candidates),
	judgeCandidates: field(z.boolean(), d.chat.judgeCandidates),
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
	starterChannelIds: field(ids, d.channels.starterChannelIds),
	musicChannelIds: field(ids, d.channels.musicChannelIds),
});

export const characterSettings = z.object({
	fillBlanks: field(z.boolean(), d.character.fillBlanks),
	basics: field(z.string(), d.character.basics),
	home: field(z.string(), d.character.home),
	work: field(z.string(), d.character.work),
	family: field(z.array(z.string()), d.character.family),
	friends: field(z.array(z.string()), d.character.friends),
	routine: field(z.string(), d.character.routine),
	interests: field(z.array(z.string()), d.character.interests),
	tastes: field(z.array(z.string()), d.character.tastes),
	opinions: field(z.array(z.string()), d.character.opinions),
	dislikes: field(z.array(z.string()), d.character.dislikes),
	weaknesses: field(z.array(z.string()), d.character.weaknesses),
	quirks: field(z.array(z.string()), d.character.quirks),
	stories: field(z.array(z.string()), d.character.stories),
	fillInstructions: field(z.string().min(1), d.character.fillInstructions),
});

// the parts of the character sheet, in the order the prompt shows them
export const characterTraits = [
	"basics",
	"home",
	"work",
	"family",
	"friends",
	"routine",
	"interests",
	"tastes",
	"opinions",
	"dislikes",
	"weaknesses",
	"quirks",
	"stories",
] as const satisfies (keyof z.output<typeof characterSettings>)[];
export type CharacterTrait = (typeof characterTraits)[number];

export const personalitySettings = z.object({
	persona: field(z.string(), d.personality.persona),
	characterGuidance: field(z.string(), d.personality.characterGuidance),
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
	judgeInstructions: field(z.string().min(1), d.personality.judgeInstructions),
	repeatedOpenerNote: field(z.string(), d.personality.repeatedOpenerNote),
	oneLineNote: field(z.string(), d.personality.oneLineNote),
	skipNote: field(z.string(), d.personality.skipNote),
	starterNote: field(z.string().min(1), d.personality.starterNote),
	skipMarker: field(z.string(), d.personality.skipMarker),
	fallbackReply: field(z.string(), d.personality.fallbackReply),
	contentFilterReply: field(z.string(), d.personality.contentFilterReply),
	notHereReply: field(z.string(), d.personality.notHereReply),
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

export const voiceSettings = z.object({
	model: field(z.string().min(1), d.voice.model),
	voice: field(z.string().min(1), d.voice.voice),
	instructions: field(z.string(), d.voice.instructions),
	answerOnlyWhenNamed: field(z.boolean(), d.voice.answerOnlyWhenNamed),
	names: field(z.string(), d.voice.names),
	followUpWindowMs: field(count, d.voice.followUpWindowMs),
	languageHint: field(z.string(), d.voice.languageHint),
	musicDuckVolume: field(chance, d.voice.musicDuckVolume),
	turnSilenceMs: field(z.int().min(200).max(5000), d.voice.turnSilenceMs),
	minSpeechMs: field(z.int().min(0).max(5000), d.voice.minSpeechMs),
	idleDisconnectMs: field(count, d.voice.idleDisconnectMs),
	leaveWhenAloneMs: field(count, d.voice.leaveWhenAloneMs),
	memoryTurns: field(z.int().min(0).max(50), d.voice.memoryTurns),
});

export const moduleSchemas = {
	chat: chatSettings,
	channels: channelsSettings,
	personality: personalitySettings,
	character: characterSettings,
	commands: commandsSettings,
	music: musicSettings,
	voice: voiceSettings,
} as const;

export type ModuleName = keyof typeof moduleSchemas;

export type Settings<M extends ModuleName> = z.output<
	(typeof moduleSchemas)[M]
>;

export type SettingsInput<M extends ModuleName> = z.input<
	(typeof moduleSchemas)[M]
>;
