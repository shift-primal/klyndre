import { getSettings } from "@klyndre/config";
import type { VoiceBasedChannel } from "discord.js";

import { loadLore, selectLore } from "#/features/chat/lore";
import type { People } from "#/features/chat/profiles";
import { buildInstructions } from "#/features/chat/prompt";

export const botNameIn = (channel: VoiceBasedChannel) =>
	channel.guild.members.me?.displayName ?? channel.client.user.username;

export const humansIn = (channel: VoiceBasedChannel) =>
	channel.members.filter((member) => !member.user.bot);

// the chat personality, lore and notes on whoever is in the call, then how to
// talk out loud, then what was said before the connection was last reopened
export async function voiceInstructions(
	channel: VoiceBasedChannel,
	memory: string[],
) {
	const guildId = channel.guild.id;
	const [voice, chat, entries] = await Promise.all([
		getSettings(guildId, "voice"),
		getSettings(guildId, "chat"),
		loadLore(guildId),
	]);
	const people: People = new Map(
		humansIn(channel).map((member) => [member.id, member.displayName]),
	);
	// nothing has been said yet to match lore against, so only the locked
	// entries and a little random self lore come along
	const lore = selectLore(entries, "", channel.id, chat);
	const chatPrompt = await buildInstructions(
		{
			guildId,
			botName: botNameIn(channel),
			server: channel.guild.name,
			channel: channel.name,
		},
		people,
		lore,
	);

	return [
		chatPrompt,
		voice.instructions &&
			`## Voice call\n${voice.instructions}\nThe chat format rules above are for text and don't apply out loud.`,
		memory.length > 0 &&
			`## Earlier in this call\n${memory.map((line) => `- ${line}`).join("\n")}`,
	]
		.filter(Boolean)
		.join("\n\n");
}

const normalize = (text: string) =>
	text
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ");

// a typo or two allowed, since names come back from speech recognition
// spelled however they sounded ("klyndre" might be heard as "klindre")
function closeEnough(word: string, name: string) {
	if (word === name) return true;
	if (name.length < 5) return false;
	// longer names get two ("klyndre" heard as "klindrer")
	const allowed = name.length >= 7 ? 2 : 1;
	if (Math.abs(word.length - name.length) > allowed) return false;
	let previous = Array.from({ length: name.length + 1 }, (_, i) => i);
	for (let i = 1; i <= word.length; i++) {
		const current = [i];
		for (let j = 1; j <= name.length; j++) {
			const cost = word[i - 1] === name[j - 1] ? 0 : 1;
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + cost,
			);
		}
		previous = current;
	}
	return (previous[name.length] ?? Infinity) <= allowed;
}

export function mentionsName(transcript: string, names: string[]) {
	const words = normalize(transcript).split(/\s+/).filter(Boolean);
	return names
		.map(normalize)
		.map((name) => name.trim())
		.filter((name) => name.length >= 2)
		.some((name) => {
			const parts = name.split(/\s+/);
			// multi-word names match as a phrase
			for (let i = 0; i + parts.length <= words.length; i++) {
				if (parts.every((part, k) => closeEnough(words[i + k] ?? "", part))) {
					return true;
				}
			}
			return false;
		});
}
