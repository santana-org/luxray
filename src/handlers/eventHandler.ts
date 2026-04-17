/**
 * 📡 Event Handler - Dynamic Loader
 *
 * Scans /events directory, imports all .ts/.js files as Event modules,
 * and registers them with the Discord client.
 *
 * Events are first-class handlers for Discord lifecycle events (ready, interactionCreate, etc).
 * Using .once flag allows one-time-only events (e.g., client ready) vs permanent listeners.
 *
 * Design pattern: same as commandHandler - declarative event files with execute method
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "discord.js";
import { getSourceExt, walkDir } from "@/utils/common/index.js";
import { LOGS, logger } from "@/utils/logger/index.js";

/**
 * Event module interface
 * Each event handler file exports { name, once?, execute }
 * Note: once is optional (defaults to false = recurring listener)
 */
interface Event {
	name: string;
	once?: boolean;
	execute(...args: unknown[]): Promise<void> | void;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration for event discovery
const EVENT_CONFIG = {
	BASE_DIR: "../events",
} as const;

/**
 * Load all events from disk and register with Discord client
 *
 * @param client - Discord.js Client instance
 *
 * Uses client.on() for recurring events (e.g. messageCreate fires many times)
 * Uses client.once() for one-time events (e.g. ready fires exactly once on startup)
 */
export async function loadEvents(client: Client): Promise<void> {
	const eventsDir = join(__dirname, EVENT_CONFIG.BASE_DIR);
	const ext = getSourceExt(import.meta.url);
	const files = walkDir(eventsDir, ext);

	for (const file of files) {
		const { default: event } = (await import(file)) as { default: Event };

		// Register listener: once or on based on event.once flag
		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}

	logger.info(LOGS.EVENTS_LOADED(files.length));
}
