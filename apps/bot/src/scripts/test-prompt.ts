import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { getSettings } from "@klyndre/config";
import { db, guildSettings, profiles } from "@klyndre/db";
import type { ModelMessage } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import "#/env";
import { loadLore, selectLore } from "#/features/chat/lore";
import {
	firstWord,
	mayStayQuiet,
	recentReplies,
	type Turn,
} from "#/features/chat/openers";
import type { People } from "#/features/chat/profiles";
import { buildInstructions, type ChatContext } from "#/features/chat/prompt";
import { type Composed, composeReply } from "#/features/chat/reply";
import { words } from "#/lib/utils/text";

const USAGE = `Usage: pnpm test:prompt <scenario file | message> [options]

  -n, --runs <n>          replies to generate (20)
  -c, --concurrency <n>   requests at once (6)
  -g, --guild <id>        whose settings, lore and profiles to use
                          (the only guild with settings, if there is one)
  -m, --model <id>        instead of the guild's chat model
  -t, --temperature <n>   instead of the model's default
      --name <name>       the bot's name in the prompt (klyndre)
      --mention           as if it was tagged, so it never stays quiet
      --no-lore           leave lore out
      --no-profiles       leave profile notes out
      --count <regex>     how many replies match, can be repeated
      --show-prompt       print the instructions and history first
  -q, --quiet             only the summary

A scenario file has one "name: text" line per message, oldest first,
optionally starting with [hh:mm]. Lines from "bot" or --name are the bot's.
Blank lines and lines starting with # are ignored.`;

const SERVER = "test server";
const CHANNEL = "general";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	allowNegative: true,
	options: {
		runs: { type: "string", short: "n", default: "20" },
		concurrency: { type: "string", short: "c", default: "6" },
		guild: { type: "string", short: "g" },
		model: { type: "string", short: "m" },
		temperature: { type: "string", short: "t" },
		name: { type: "string", default: "klyndre" },
		mention: { type: "boolean", default: false },
		lore: { type: "boolean", default: true },
		profiles: { type: "boolean", default: true },
		count: { type: "string", multiple: true, default: [] },
		"show-prompt": { type: "boolean", default: false },
		quiet: { type: "boolean", short: "q", default: false },
		help: { type: "boolean", short: "h", default: false },
	},
});

type Line = { name: string; text: string; bot: boolean };

const number = (flag: string, value: string | undefined) => {
	if (value === undefined) return undefined;
	const parsed = Number(value);
	if (Number.isNaN(parsed)) throw new Error(`--${flag} must be a number`);
	return parsed;
};

const isBot = (name: string) =>
	/^bot$/i.test(name) || name.toLowerCase() === values.name.toLowerCase();

const parseScenario = (text: string): Line[] =>
	text
		.split("\n")
		.map((line) => line.trim().replace(/^\[\d{1,2}:\d{2}\]\s*/, ""))
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const colon = line.indexOf(":");
			if (colon === -1) throw new Error(`Line has no "name:" part: ${line}`);
			const name = line.slice(0, colon).trim();
			return { name, text: line.slice(colon + 1).trim(), bot: isBot(name) };
		});

async function loadScenario(arg: string) {
	const lines = existsSync(arg)
		? parseScenario(await readFile(arg, "utf8"))
		: parseScenario(`tester: ${arg}`);
	const last = lines.at(-1);
	if (!last || last.bot) {
		throw new Error("The last line must be a person, not the bot");
	}
	return { lines, last };
}

// the guild's settings when there's only one, defaults when there are none
async function resolveGuild() {
	if (values.guild) return values.guild;
	const rows = await db
		.selectDistinct({ guildId: guildSettings.guildId })
		.from(guildSettings);
	if (rows.length > 1) {
		throw new Error(
			`Several guilds have settings, pick one with -g: ${rows.map((row) => row.guildId).join(", ")}`,
		);
	}
	return rows[0]?.guildId ?? "test";
}

// the same shape buildHistory gives the live bot
const toHistory = (lines: Line[]): ModelMessage[] =>
	lines.map((line) =>
		line.bot
			? { role: "assistant", content: line.text }
			: { role: "user", content: `${line.name}: ${line.text}` },
	);

// names are matched to profiles; a name without one is its own id, which has no notes
async function peopleIn(guildId: string, lines: Line[]): Promise<People> {
	const names = [
		...new Set(
			lines
				.filter((line) => !line.bot)
				.map((line) => line.name)
				.reverse(),
		),
	];
	const rows = values.profiles
		? await db
				.select({ userId: profiles.userId, name: profiles.name })
				.from(profiles)
				.where(
					and(eq(profiles.guildId, guildId), inArray(profiles.name, names)),
				)
		: [];
	const ids = new Map(rows.map((row) => [row.name, row.userId]));
	return new Map(names.map((name) => [ids.get(name) ?? name, name]));
}

async function pool<T>(count: number, limit: number, task: () => Promise<T>) {
	const results: T[] = [];
	let started = 0;
	const worker = async () => {
		while (started < count) {
			started++;
			results.push(await task());
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
	return results;
}

// a run of words straight after the same run, like "ok bro ok bro"
function isLoop(text: string) {
	const w = text.split(/\s+/);
	for (let size = 2; size * 2 <= w.length; size++) {
		for (let i = 0; i + size * 2 <= w.length; i++) {
			if (
				w.slice(i, i + size).join(" ") ===
				w.slice(i + size, i + size * 2).join(" ")
			) {
				return true;
			}
		}
	}
	return false;
}

if (values.help || !positionals[0]) {
	console.log(USAGE);
	process.exit(values.help ? 0 : 1);
}

const runs = number("runs", values.runs) ?? 20;
const concurrency = number("concurrency", values.concurrency) ?? 6;
const temperature = number("temperature", values.temperature);

const { lines, last } = await loadScenario(positionals[0]);
const guildId = await resolveGuild();
const chat = await getSettings(guildId, "chat");
const context: ChatContext = {
	guildId,
	botName: values.name,
	server: SERVER,
	channel: CHANNEL,
};

const history = toHistory(lines);
const people = await peopleIn(guildId, lines);
const humanText = lines
	.filter((line) => !line.bot)
	.map((line) => line.text)
	.join("\n");
const loreEntries =
	values.lore && chat.loreEnabled ? await loadLore(guildId) : [];
const recent = recentReplies(history, chat.openerMemory);
const turn: Turn = {
	recent,
	canSkip:
		!values.mention && mayStayQuiet(last.text, recent, chat.skipMaxWords),
};

// lore is picked again every run, the random fill changes like it would live
const instructionsFor = () =>
	buildInstructions(
		context,
		people,
		selectLore(loreEntries, humanText, "test-prompt", chat),
	);

if (values["show-prompt"]) {
	console.log(`=== INSTRUCTIONS ===\n${await instructionsFor()}\n`);
	console.log(
		`=== HISTORY ===\n${lines.map((line) => `${line.bot ? `${values.name} (bot)` : line.name}: ${line.text}`).join("\n")}\n`,
	);
}

console.log(
	[
		`guild ${guildId}`,
		`model ${values.model ?? chat.model}`,
		temperature !== undefined && `temperature ${temperature}`,
		`lore ${loreEntries.length > 0 ? `${loreEntries.length} ${loreEntries.length === 1 ? "entry" : "entries"}` : "off"}`,
		`profiles ${values.profiles && chat.profilesEnabled ? "on" : "off"}`,
		turn.canSkip && "may stay quiet",
	]
		.filter(Boolean)
		.join(", "),
);
console.log(`Running ${runs}x against "${last.text}"\n`);

type Result = Composed & { number: number; seconds: number };
let printed = 0;

const results = await pool(runs, concurrency, async (): Promise<Result> => {
	const started = performance.now();
	const composed = await composeReply(
		context,
		await instructionsFor(),
		history,
		turn,
		{ model: values.model, temperature },
	);
	const number = ++printed;
	if (!values.quiet) {
		const tags = [
			composed.outcome !== "reply" && composed.outcome,
			composed.retried && "retried",
			composed.finishReason === "length" && "token cap",
		].filter(Boolean);
		const text = composed.outcome === "quiet" ? "" : composed.text;
		console.log(
			`${String(number).padStart(4)}  ${text}${tags.length ? `  [${tags.join(", ")}]` : ""}`,
		);
	}
	return { ...composed, number, seconds: (performance.now() - started) / 1000 };
});

const replies = results.filter((result) => result.outcome === "reply");
const n = replies.length;
const of = (count: number) => `${count}/${n}`;
const outcomes = (["quiet", "fallback", "filtered"] as const)
	.map((outcome) => [
		outcome,
		results.filter((result) => result.outcome === outcome).length,
	])
	.filter(([, count]) => count)
	.map(([outcome, count]) => `${count} ${outcome}`);

console.log("\n=== Summary ===");
console.log(
	`replies: ${n}/${runs}${outcomes.length ? ` (${outcomes.join(", ")})` : ""}`,
);
if (n === 0) process.exit(0);

const average = (pick: (result: Result) => number) =>
	(replies.reduce((sum, result) => sum + pick(result), 0) / n).toFixed(1);
console.log(
	`avg ${average((result) => result.text.split(/\s+/).length)} words, ${average((result) => result.seconds)}s per reply`,
);

const retried = results.filter((result) => result.retried).length;
if (retried) console.log(`opener retries: ${retried}/${runs}`);

const runaways = replies.filter(
	(result) => result.finishReason === "length" || isLoop(result.text),
);
if (runaways.length)
	console.log(`loops / hit token cap: ${of(runaways.length)}`);

const threshold = Math.max(3, Math.ceil(n * 0.2));
const habits = (counts: Map<string, number>) =>
	[...counts].filter(([, c]) => c >= threshold).sort((a, b) => b[1] - a[1]);
const tally = (lists: Iterable<string>[]) => {
	const counts = new Map<string, number>();
	for (const list of lists) {
		for (const word of list) counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	return counts;
};

const openers = habits(
	tally(replies.map((result) => [firstWord(result.text)].filter(Boolean))),
);
console.log(
	openers.length
		? `repeated openers (in >=${threshold} replies):\n${openers.map(([w, c]) => `  ${w.padEnd(16)} ${of(c)}`).join("\n")}`
		: `repeated openers: none in >=${threshold} replies`,
);

const fromChat = words(lines.map((line) => line.text).join("\n"));
const repeated = habits(
	tally(
		replies.map((result) =>
			[...words(result.text)].filter((word) => [...word].length >= 4),
		),
	),
);
console.log(
	repeated.length
		? `repeated words (in >=${threshold} replies):\n${repeated.map(([w, c]) => `  ${w.padEnd(16)} ${of(c)}${fromChat.has(w) ? "  (from the chat, probably fine)" : ""}`).join("\n")}`
		: `repeated words: none in >=${threshold} replies`,
);

for (const pattern of values.count) {
	const re = new RegExp(pattern, "i");
	console.log(
		`/${pattern}/: ${of(replies.filter((result) => re.test(result.text)).length)}`,
	);
}

process.exit(0);
