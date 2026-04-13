import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// 🔍 File extension detection constants
const SOURCE_EXTENSIONS = {
	TYPESCRIPT: ".ts",
	JAVASCRIPT: ".js",
} as const;

export function getSourceExt(importMetaUrl: string): string {
	return fileURLToPath(importMetaUrl).endsWith(SOURCE_EXTENSIONS.TYPESCRIPT)
		? SOURCE_EXTENSIONS.TYPESCRIPT
		: SOURCE_EXTENSIONS.JAVASCRIPT;
}

/**
 * 📂 Recursively walks `dir` and returns the absolute paths of all files
 * whose names end with `ext`. Throws if the directory cannot be read.
 */
export function walkDir(dir: string, ext: string): string[] {
	const results: string[] = [];
	let entries: string[];

	try {
		entries = readdirSync(dir);
	} catch (err) {
		throw new Error(`❌ Failed to read directory: ${dir}`, { cause: err });
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		try {
			if (statSync(fullPath).isDirectory()) {
				results.push(...walkDir(fullPath, ext));
			} else if (entry.endsWith(ext)) {
				results.push(fullPath);
			}
		} catch (err) {
			throw new Error(`❌ Failed to stat path: ${fullPath}`, { cause: err });
		}
	}
	return results;
}
