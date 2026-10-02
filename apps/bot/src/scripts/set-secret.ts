import { readFileSync } from "node:fs";
import { type SecretKey, setSecret } from "@klyndre/config";
import "#/env";

const keys: SecretKey[] = ["youtube-cookies"];
const [key, file] = process.argv.slice(2);

if (!keys.includes(key as SecretKey)) {
	console.error(`Usage: pnpm set:secret <${keys.join("|")}> [file]`);
	console.error(
		"Reads the value from the file, or from stdin if no file is given.",
	);
	process.exit(1);
}

const value = readFileSync(file ?? 0, "utf8");
await setSecret(key as SecretKey, value);
console.log(`Saved ${key} (${value.length} characters)`);
process.exit(0);
