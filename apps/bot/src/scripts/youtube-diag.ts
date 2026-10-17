import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "discord-player-youtubei";
import { createAdaptiveStream } from "simple-ytdl-core";
import youtubeDl from "youtube-dl-exec";
import { Innertube, type Types } from "youtubei.js";

import "#/env";
import { cookieHeader, loadCookies } from "#/features/music/extractors/youtube";

// shows, on the machine it runs on, which YouTube clients adaptive can stream
// from and where yt-dlp spends its time, with and without the cookies. Usage:
// pnpm youtube:diag [cookies.txt], the cookies from the database otherwise

const VIDEO = "X9CsK_nuqdE";
const CLIENTS: Types.InnerTubeClient[] = [
	"VISIONOS",
	"IOS",
	"ANDROID",
	"TV",
	"MWEB",
	"WEB_EMBEDDED",
];
const YTDLP_LINE =
	/^\[(youtube|info|download)\]|Sleeping|ERROR|WARNING|Detected|playability/;

const [file] = process.argv.slice(2);
const cookies = file ? readFileSync(file, "utf8") : await loadCookies();
const cookieFile = join(tmpdir(), "yt-diag-cookies.txt");
writeFileSync(cookieFile, cookies);
const header = cookieHeader(cookies);

const since = (start: number) => `${Math.round(performance.now() - start)}ms`;
const message = (error: unknown) =>
	(error instanceof Error ? error.message : String(error)).slice(0, 100);

console.log(`cookies: ${header ? header.split("; ").length : "none"}`);
console.log(
	"public ip:",
	await fetch("https://api.ipify.org")
		.then((res) => res.text())
		.catch(message),
);

async function adaptive(cookie: string | undefined) {
	const start = performance.now();
	const yt = await Innertube.create({ retrieve_player: true, cookie });
	console.log(
		`\n== adaptive ${cookie ? "with" : "without"} cookies (session ${since(start)}, logged in: ${yt.session.logged_in})`,
	);
	for (const client of CLIENTS) {
		const tried = performance.now();
		try {
			const stream = await createAdaptiveStream(
				yt,
				VIDEO,
				client,
				undefined,
				client !== "VISIONOS",
			);
			await new Promise((resolve, reject) =>
				stream.once("data", resolve).once("error", reject),
			);
			stream.destroy();
			console.log(`  ${client.padEnd(13)} ok ${since(tried)}`);
		} catch (error) {
			console.log(
				`  ${client.padEnd(13)} FAIL ${since(tried)}: ${message(error)}`,
			);
		}
	}
}

async function ytdlp(withCookies: boolean) {
	console.log(`\n== yt-dlp ${withCookies ? "with" : "without"} cookies`);
	const start = performance.now();
	const dl = youtubeDl.exec(`https://youtu.be/${VIDEO}`, {
		verbose: true,
		format: "bestaudio",
		output: "-",
		noProgress: true,
		jsRuntimes: "node",
		cookies: withCookies ? cookieFile : undefined,
	});
	let partial = "";
	dl.stderr?.on("data", (chunk: Buffer) => {
		const lines = (partial + chunk.toString()).split("\n");
		partial = lines.pop() ?? "";
		for (const line of lines) {
			if (YTDLP_LINE.test(line) && !line.includes("Destination")) {
				console.log(`  ${since(start).padStart(7)} ${line.slice(0, 150)}`);
			}
		}
	});
	dl.stdout?.once("data", () => {
		console.log(`  ${since(start).padStart(7)} FIRST AUDIO`);
		dl.kill();
	});
	await dl.catch(() => {});
}

if (header) await adaptive(header);
await adaptive(undefined);
if (header) await ytdlp(true);
await ytdlp(false);
process.exit(0);
