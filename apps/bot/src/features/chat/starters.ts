import { getSettings } from "@klyndre/config";
import type { ModelMessage } from "ai";
import { type Client, Events, type Guild, type Message } from "discord.js";

import { buildHistory } from "#/features/chat/history";
import { maybeUpdateLore, noteUsage, pickLore } from "#/features/chat/lore";
import { recentReplies } from "#/features/chat/openers";
import { buildInstructions, chatContext } from "#/features/chat/prompt";
import { composeReply, deliver } from "#/features/chat/reply";
import { inTurn } from "#/features/chat/turns";

// starting a conversation in a channel that's been quiet for a while, like people do

const CHECK_EVERY_MS = 10 * 60_000;

// per channel, how many it started on which day (in the chat time zone)
const started = new Map<string, { day: string; count: number }>();

// "3 hours", "2 days"
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
	const [{ openerMemory }, { starterNote }] = await Promise.all([
		getSettings(guildId, "chat"),
		getSettings(guildId, "personality"),
	]);
	const { messages, people, humanText } = await buildHistory(last);
	const lore = await pickLore(last, humanText);
	const context = chatContext(last);
	const instructions = await buildInstructions(context, people, lore);

	const note = starterNote.replaceAll("{hours}", describeQuiet(quietMs));
	const history: ModelMessage[] = [
		...messages,
		{ role: "user", content: `(note to you: ${note})` },
	];
	const { text, outcome } = await composeReply(context, instructions, history, {
		recent: recentReplies(messages, openerMemory),
		canSkip: false,
	});
	// a fallback like "brain lagged" makes no sense out of nowhere
	if (outcome !== "reply" || !text) return false;

	await deliver(last.channel, text);
	console.log(
		`[chat] started a conversation in #${last.channel.name}: ${text}`,
	);
	await noteUsage(last, lore.unprompted, text);
	void maybeUpdateLore(last, messages, text);
	return true;
}

async function maybeStart(guild: Guild, channelId: string) {
	const chat = await getSettings(guild.id, "chat");
	const { hour, day } = clock(chat.timeZone);
	if (hour < chat.starterFromHour || hour >= chat.starterToHour) return;

	const today = started.get(channelId);
	const count = today?.day === day ? today.count : 0;
	if (count >= chat.starterMaxPerDay) return;
	// rolled before looking at the channel, so most checks cost nothing
	if (Math.random() >= chat.starterChance) return;

	const channel = guild.channels.cache.get(channelId);
	if (!channel?.isTextBased() || !channel.isSendable()) return;
	const last = (await channel.messages.fetch({ limit: 1 })).first();
	// never twice in a row without anyone answering
	if (!last || last.author.id === guild.client.user.id) return;
	const quietMs = Date.now() - last.createdTimestamp;
	if (quietMs < chat.starterQuietMs) return;

	await inTurn(channelId, chat.turnWaitLimitMs, async () => {
		if (await start(last, quietMs)) {
			started.set(channelId, { day, count: count + 1 });
		}
	});
}

async function checkAll(client: Client<true>) {
	for (const guild of client.guilds.cache.values()) {
		const { starterChannelIds } = await getSettings(guild.id, "channels");
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
