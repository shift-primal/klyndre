import { getSettings } from "@klyndre/config";
import type { ModelMessage } from "ai";
import { type Client, Events, type Guild, type Message } from "discord.js";

import {
	maybeFillCharacter,
	maybeUpdateCharacter,
} from "#/features/chat/character";
import { buildHistory } from "#/features/chat/history";
import {
	maybeUpdateLore,
	noteStoriesUsed,
	noteUsage,
	pickLore,
	pickStories,
} from "#/features/chat/lore";
import { buildInstructions, chatContext } from "#/features/chat/prompt";
import { composeReply, deliver } from "#/features/chat/reply";
import { inTurn } from "#/features/chat/turns";

const CHECK_EVERY_MS = 10 * 60_000;
const STARTER_FROM_HOUR = 10;
const STARTER_TO_HOUR = 23;
const STARTER_CHANCE = 0.1;

const started = new Map<string, { day: string; count: number }>();

const describeQuiet = (ms: number) => {
	const hours = Math.max(1, Math.round(ms / 3_600_000));
	if (hours < 24) return hours === 1 ? "an hour" : `${hours} hours`;
	const days = Math.round(hours / 24);
	return days === 1 ? "a day" : `${days} days`;
};

const clock = (timeZone: string) => {
	const now = new Date();
	return {
		hour: Number(
			now.toLocaleString("en-GB", {
				timeZone,
				hour: "numeric",
				hourCycle: "h23",
			}),
		),
		day: now.toLocaleDateString("en-CA", { timeZone }),
	};
};

async function start(last: Message<true>, quietMs: number) {
	const { guildId } = last;
	const { starterNote } = await getSettings(guildId, "internals");
	const context = chatContext(last);
	void maybeFillCharacter(context);
	const { messages, people, humanText } = await buildHistory(last);
	const [lore, stories] = await Promise.all([
		pickLore(last, humanText),
		pickStories(guildId, humanText),
	]);
	const instructions = await buildInstructions(context, people, lore, stories);

	const note = starterNote.replaceAll("{hours}", describeQuiet(quietMs));
	const history: ModelMessage[] = [
		...messages,
		{ role: "user", content: `(note to you: ${note})` },
	];
	const { text, outcome } = await composeReply(context, instructions, history);
	if (outcome !== "reply" || !text) return false;

	await deliver(last.channel, text);
	console.log(
		`[chat] started a conversation in #${last.channel.name}: ${text}`,
	);
	await noteUsage(last, lore.unprompted, text);
	await noteStoriesUsed(stories).catch((error) =>
		console.error("[chat] starter", error),
	);
	void maybeUpdateLore(last, messages, text);
	void maybeUpdateCharacter(context, messages, text);
	return true;
}

async function maybeStart(guild: Guild, channelId: string) {
	const replies = await getSettings(guild.id, "replies");
	const { hour, day } = clock(replies.timeZone);
	if (hour < STARTER_FROM_HOUR || hour >= STARTER_TO_HOUR) return;

	const today = started.get(channelId);
	const count = today?.day === day ? today.count : 0;
	if (count >= replies.starterMaxPerDay) return;
	if (Math.random() >= STARTER_CHANCE) return;

	const channel = guild.channels.cache.get(channelId);
	if (!channel?.isTextBased() || !channel.isSendable()) return;
	const last = (await channel.messages.fetch({ limit: 1 })).first();
	if (!last || last.author.id === guild.client.user.id) return;
	const quietMs = Date.now() - last.createdTimestamp;
	if (quietMs < replies.starterQuietMs) return;

	await inTurn(channelId, replies.turnWaitLimitMs, async () => {
		if (await start(last, quietMs)) {
			started.set(channelId, { day, count: count + 1 });
		}
	});
}

async function checkAll(client: Client<true>) {
	for (const guild of client.guilds.cache.values()) {
		const { starterChannelIds } = await getSettings(guild.id, "replies");
		for (const channelId of starterChannelIds) {
			await maybeStart(guild, channelId).catch((error) =>
				console.error("[chat] starter", error),
			);
		}
	}
}

export function scheduleStarters(client: Client) {
	client.once(Events.ClientReady, (ready) => {
		setInterval(() => {
			checkAll(ready).catch((error) => console.error("[chat] starter", error));
		}, CHECK_EVERY_MS);
	});
}
