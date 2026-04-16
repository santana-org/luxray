/**
 * 🔄 Mute Expiration Handler
 *
 * Hybrid expiration strategy:
 * - Short mutes (< 24h): Individual setTimeout timers for exact expiration
 * - Long mutes (>= 24h): Periodic polling every 5 minutes as safety net
 * - On startup: Reconstruct timers from database
 *
 * Flow:
 * 1. Initialize mute system and reconstruct timers from database on startup
 * 2. Run periodic cleanup every 5 minutes for long mutes (safety net)
 * 3. Remove expired mute roles from members
 * 4. Log results
 *
 * Design:
 * - Most mutes expire exactly via setTimeout (zero polling overhead)
 * - Long mutes use polling as safety net (Node.js setTimeout limit is ~24.8 days)
 * - Graceful failure: if one user fails, continues with others
 * - Persistent: expired mutes removed from database by mutes.ts
 */

import { type Client, Events } from "discord.js";
import { LOGS, logger } from "@/utils/logger/index.js";
import {
	checkAndExpireOldMutes,
	getPollingInterval,
	initializeMuteSystem,
} from "@/utils/moderation/index.js";

/**
 * Initialize mute expiration handler
 * - Initialize mute system and reconstruct timers on startup
 * - Set up periodic cleanup for long mutes
 */
export default {
	name: Events.ClientReady,
	once: true, // Run exactly once on startup
	async execute(client: Client<true>): Promise<void> {
		try {
			logger.info(LOGS.MUTE_EXPIRATION_HANDLER_STARTING);

			// Initialize mute system and reconstruct timers from database
			await initializeMuteSystem(client);

			// Run immediate cleanup for any expired mutes
			await checkAndExpireOldMutes(client);

			// Then check periodically for long mutes (as safety net)
			const pollingInterval = getPollingInterval();
			setInterval(async () => {
				await checkAndExpireOldMutes(client);
			}, pollingInterval);

			logger.info(LOGS.MUTE_EXPIRATION_HANDLER_READY);
		} catch (error) {
			logger.error(LOGS.MUTE_EXPIRATION_HANDLER_FAILED, error);
		}
	},
};
