/**
 * Direct Message Notification Utilities
 *
 * Centralized DM sending for moderation actions:
 * - Consistent formatting for all moderation messages
 * - Optional reason and additional info (duration, etc.)
 * - Graceful handling of disabled DMs
 * - Proper error logging without blocking
 *
 * Eliminates ~40+ lines of duplicate DM code
 */

import type { User } from "discord.js";
import { logger } from "@/utils/logger/index.js";

/**
 * Send moderation action DM to user
 *
 * @param user - Target user to send DM to
 * @param action - Action past tense ("kicked", "banned", "muted")
 * @param guildName - Server name for context
 * @param reason - Optional reason for the action
 * @param additionalInfo - Optional extra info (e.g., "for 1h 30m")
 * @returns true if DM sent successfully, false otherwise
 */
export async function sendModerationDM(
	user: User,
	action: string,
	guildName: string,
	reason?: string | null,
	additionalInfo?: string,
): Promise<boolean> {
	try {
		let message = `You have been ${action} from **${guildName}**`;

		if (additionalInfo) {
			message += ` ${additionalInfo}`;
		}

		if (reason) {
			message += ` for: ${reason}`;
		} else {
			message += ".";
		}

		await user.send(message);
		return true;
	} catch (err) {
		// Silently ignore if DMs are disabled or blocked
		// Log at debug level for troubleshooting
		logger.debug(
			`Failed to send DM to user ${user.id} for action "${action}"`,
			err,
		);
		return false;
	}
}

/**
 * Build formatted message for moderation action DM
 * (Useful if you want the message without sending)
 */
export function buildModerationMessage(
	action: string,
	guildName: string,
	reason?: string | null,
	additionalInfo?: string,
): string {
	let message = `You have been ${action} from **${guildName}**`;

	if (additionalInfo) {
		message += ` ${additionalInfo}`;
	}

	if (reason) {
		message += ` for: ${reason}`;
	} else {
		message += ".";
	}

	return message;
}
