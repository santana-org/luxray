/**
 * 🔄 Mute Expiration Handler
 *
 * Hybrid expiration strategy:
 * - Short mutes (< 24h): Individual setTimeout timers for exact expiration
 * - Long mutes (>= 24h): Periodic polling every 5 minutes as safety net
 * - On startup: Reconstruct timers from database
 *
 * Flow:
 * 1. Reconstruct mute timers from database on startup
 * 2. Run periodic cleanup every 5 minutes for long mutes
 * 3. Remove expired mute roles from members
 * 4. Log results
 *
 * Design:
 * - Most mutes expire exactly via setTimeout (zero polling overhead)
 * - Long mutes use polling as safety net (Node.js setTimeout limit is ~24.8 days)
 * - Graceful failure: if one guild fails, continues with others
 * - Persistent: expired mutes removed from database
 */

import { type Client, Events } from "discord.js";
import { logger } from "../utils/logger.js";
import { requireMuteRoleId } from "../utils/muteConfig.js";
import {
	cleanupExpiredMutes,
	getMutedUsers,
	reconstructMuteTimersFromDatabase,
} from "../utils/mutes.js";

// Check for expired long mutes every 5 minutes
const LONG_MUTE_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Remove mute role from a member
 * Silently fails if member is no longer in guild or role doesn't exist
 */
async function removeExpiredMute(
	guildId: string,
	userId: string,
	client: Client<true>,
): Promise<boolean> {
	try {
		const guild = client.guilds.cache.get(guildId);
		if (!guild) return false;

		const member = await guild.members.fetch(userId).catch(() => null);
		if (!member) return false;

		const muteRoleId = requireMuteRoleId();
		if (!muteRoleId || !member.roles.cache.has(muteRoleId)) {
			return false;
		}

		const muteRole = guild.roles.cache.get(muteRoleId);
		if (!muteRole) return false;

		await member.roles.remove(muteRole, "Mute expired");
		return true;
	} catch (err) {
		logger.debug(
			`Failed to remove mute for user ${userId} in guild ${guildId}`,
			err,
		);
		return false;
	}
}

/**
 * Check for expired long mutes (>= 24h) and remove them
 * Short mutes are handled by individual setTimeout timers
 */
async function checkAndRemoveLongExpiredMutes(
	client: Client<true>,
): Promise<void> {
	try {
		// First, clean up expired mutes from database
		const expiredCount = cleanupExpiredMutes();
		if (expiredCount > 0) {
			logger.debug(`Cleaned up ${expiredCount} expired mutes from database`);
		}

		let totalRemoved = 0;

		// For each guild, check remaining mutes and remove roles if needed
		for (const guild of client.guilds.cache.values()) {
			const mutedUsers = getMutedUsers(guild.id);

			for (const { userId } of mutedUsers) {
				const removed = await removeExpiredMute(guild.id, userId, client);
				if (removed) {
					totalRemoved++;
				}
			}
		}

		if (totalRemoved > 0) {
			logger.debug(`Removed mute role from ${totalRemoved} members`);
		}
	} catch (err) {
		logger.error("Error checking expired mutes", err);
	}
}

/**
 * Initialize mute expiration handler
 * - Reconstruct timers on startup
 * - Set up periodic long mute cleanup every 5 minutes
 */
export default {
	name: Events.ClientReady,
	once: true, // Run exactly once on startup
	async execute(client: Client<true>): Promise<void> {
		logger.info("🔄 Mute expiration handler initialized");

		// Reconstruct timers from database for active mutes
		reconstructMuteTimersFromDatabase(client);

		// Run immediate cleanup
		await checkAndRemoveLongExpiredMutes(client);

		// Then check every 5 minutes for long mutes (as safety net)
		setInterval(async () => {
			await checkAndRemoveLongExpiredMutes(client);
		}, LONG_MUTE_CHECK_INTERVAL);
	},
};
