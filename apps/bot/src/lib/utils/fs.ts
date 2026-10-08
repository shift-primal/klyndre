import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findRoot(startDir: string): string {
	let currentDir = startDir;
	while (currentDir !== dirname(currentDir)) {
		if (existsSync(resolve(currentDir, "pnpm-workspace.yaml"))) {
			return currentDir;
		}
		currentDir = dirname(currentDir);
	}
	return startDir;
}

const ROOT = findRoot(import.meta.dirname);

export const rootPath = (path: string) => resolve(ROOT, path);

