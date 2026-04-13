/**
 * 📂 File Path Utilities
 *
 * These helpers work with Node.js module system to support both
 * TypeScript source (.ts) and compiled JavaScript (.js) files.
 *
 * Why separate utilities?
 * - import.meta.url always points to current file's absolute URL
 * - Need to detect if running compiled (.js) vs source (.ts)
 * - Same logic used by both command and event handlers
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Source file extensions: detect which one to search for
const SOURCE_EXTENSIONS = {
	TYPESCRIPT: ".ts",
	JAVASCRIPT: ".js",
} as const;

/**
 * Detect which file extension to look for
 *
 * In development (ts-node/tsx): import.meta.url ends with .ts
 * In production (compiled): import.meta.url ends with .js
 * This lets handlers search for the right extension without configuration
 *
 * @param importMetaUrl - import.meta.url from calling module
 * @returns ".ts" or ".js"
 */
export function getSourceExt(importMetaUrl: string): string {
	return fileURLToPath(importMetaUrl).endsWith(SOURCE_EXTENSIONS.TYPESCRIPT)
		? SOURCE_EXTENSIONS.TYPESCRIPT
		: SOURCE_EXTENSIONS.JAVASCRIPT;
}

/**
 * Recursively walk directory and collect files matching extension
 *
 * Used by both commandHandler and eventHandler to discover files.
 * Throws immediately on filesystem errors to fail loudly (better than silently
 * skipping files and wondering why commands/events didn't load).
 *
 * @param dir - Directory to scan
 * @param ext - File extension to match (e.g., ".ts" or ".js")
 * @returns Array of absolute paths to matching files
 * @throws Error if directory can't be read or files can't be stat'd
 *
 * Example: walkDir("./src/commands", ".ts") => ["/app/src/commands/clear.ts", "/app/src/commands/ping.ts"]
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
				// Recursively scan subdirectories
				results.push(...walkDir(fullPath, ext));
			} else if (entry.endsWith(ext)) {
				// Collect files matching extension
				results.push(fullPath);
			}
		} catch (err) {
			throw new Error(`❌ Failed to stat path: ${fullPath}`, { cause: err });
		}
	}
	return results;
}
