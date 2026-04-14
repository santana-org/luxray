/**
 * 🌟 Luxray Discord Bot - Entry Point
 *
 * Bootstrap sequence:
 * 1. Initialize databases (mutes)
 * 2. Load event handlers (client lifecycle: ready, interactionCreate, messageCreate)
 * 3. Load slash commands from /commands directory
 * 4. Authenticate with Discord using token from .env
 *
 * If any step fails, log error and exit with code 1 to prevent zombie process
 */

import { client } from "./core/client.js";
import { config } from "./core/config.js";
import { loadCommands } from "./handlers/commandHandler.js";
import { loadEvents } from "./handlers/eventHandler.js";
import { LOGS, logger } from "./utils/logger.js";
import { initializeMuteDatabase } from "./utils/mutes.js";

/**
 * Initialize and start the Discord bot
 * Order matters: databases first, events before login to catch client ready event
 */
async function main(): Promise<void> {
	initializeMuteDatabase();
	await loadEvents(client);
	await loadCommands(client);
	await client.login(config.token);
}

main().catch((error) => {
	logger.error(LOGS.BOOT_FAILED, error);
	process.exit(1);
});
