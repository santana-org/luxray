/**
 * Moderation Error Handling Utilities
 *
 * Centralized error handling for moderation commands:
 * - Consistent error logging pattern
 * - Unified user-facing error messages
 * - Prevents error-handling boilerplate
 *
 * Eliminates ~30+ lines of duplicate error handling
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { logError } from "@/utils/common/index.js";
import { sendError } from "@/utils/embeds/index.js";

/**
 * Handle moderation command errors
 * Logs error and sends appropriate user message
 */
export async function handleModerationError(
	error: unknown,
	interaction: ChatInputCommandInteraction,
	commandName: string,
	failureMessage: string,
): Promise<void> {
	// Log error for debugging
	logError(commandName, error);

	// Send user-facing error message
	await sendError(
		interaction,
		`${commandName.charAt(0).toUpperCase() + commandName.slice(1)} Failed`,
		failureMessage,
	);
}

/**
 * Handle and log moderation errors with custom title
 */
export async function handleModerationErrorWithTitle(
	error: unknown,
	interaction: ChatInputCommandInteraction,
	commandName: string,
	titleOverride: string,
	failureMessage: string,
): Promise<void> {
	// Log error for debugging
	logError(commandName, error);

	// Send user-facing error message
	await sendError(interaction, titleOverride, failureMessage);
}
