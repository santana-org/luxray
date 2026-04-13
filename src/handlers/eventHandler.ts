import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "discord.js";
import { logger, LOGS } from "../utils/logger.js";
import { getSourceExt, walkDir } from "../utils/paths.js";

// 🎯 Event handler interface
interface Event {
	name: string;
	once?: boolean;
	execute(...args: unknown[]): Promise<void> | void;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// 📋 Event handler configuration
const EVENT_CONFIG = {
	BASE_DIR: "../events",
} as const;

export async function loadEvents(client: Client): Promise<void> {
	const eventsDir = join(__dirname, EVENT_CONFIG.BASE_DIR);
	const ext = getSourceExt(import.meta.url);
	const files = walkDir(eventsDir, ext);

	for (const file of files) {
		const { default: event } = (await import(file)) as { default: Event };

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}

	logger.info(LOGS.EVENTS_LOADED(files.length));
}
