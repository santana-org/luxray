/**
 * 📊 Logger Utility
 *
 * Centralized logging for consistent format and redaction across all modules.
 * Using @santana-org/logger which handles colors, timestamps, and secrets redaction.
 *
 * Redaction automatically removes sensitive values (token, password, secret keys)
 * from logs to prevent accidental credential exposure in logs files or dashboards.
 */

import { createLogger } from "@santana-org/logger";

// Logger configuration: info level, timestamps enabled, redact secrets
const LOGGER_CONFIG = {
	LEVEL: "info",
	LABEL: "Luxray 🌟",
	TIMESTAMPS: true,
	DATE_FORMAT: "datetime",
	REDACT_KEYS: ["token", "password", "secret"] as string[],
} as const;

export const logger = createLogger({
	level: LOGGER_CONFIG.LEVEL,
	label: LOGGER_CONFIG.LABEL,
	timestamps: LOGGER_CONFIG.TIMESTAMPS,
	dateFormat: LOGGER_CONFIG.DATE_FORMAT,
	redact: LOGGER_CONFIG.REDACT_KEYS,
});

/**
 * Log message templates
 *
 * Centralizing strings enables:
 * - Consistent emoji and formatting across logs
 * - Easy i18n/localization (replace entire LOGS object)
 * - Typo prevention (compile-time access vs hardcoded strings)
 *
 * Template functions receive dynamic data (counts, names, error details)
 */
export const LOGS = {
	// Bot lifecycle
	BOT_READY: (tag: string) => `🤖 Bot ready — logged in as ${tag}`,
	EVENTS_LOADED: (count: number) => `📡 Events loaded: ${count}`,
	COMMANDS_LOADED: (count: number) => `🔧 Commands loaded: ${count}`,
	COMMANDS_REGISTERED: (count: number, scope: string) =>
		`✅ Slash commands registered: ${count} (${scope})`,
	BOOT_FAILED: "❌ Failed to start bot",

	// Commands
	UNKNOWN_COMMAND: (name: string) => `❓ Unknown slash command: ${name}`,
	COMMAND_ERROR: (name: string) => `⚡ Error in slash command: ${name}`,
	UNKNOWN_PREFIX_CMD: (name: string) => `❓ Unknown prefix command: ${name}`,
	PREFIX_CMD_ERROR: (name: string) => `⚡ Error in prefix command: ${name}`,

	// Mute system
	MUTES_INITIALIZED: "Mute system initialized successfully",
	MUTES_INIT_FAILED: "Failed to initialize mute system",
	MUTES_CLEANED_UP: "Mute system cleaned up",
	MUTES_POLLING_ERROR: "Polling error during expiration check",
	MUTES_EXPIRED: (count: number) => `Expired ${count} mutes`,
	MUTES_CHECK_FAILED: "Failed to check expired mutes",
	MUTE_ADDED: (userId: string, guildId: string, duration: number) =>
		`Added mute for ${userId} in guild ${guildId} (${duration}ms)`,
	MUTE_ADD_FAILED: (userId: string) => `Failed to add mute for ${userId}`,
	MUTE_REMOVED: (userId: string, guildId: string) =>
		`Removed mute for ${userId} in guild ${guildId}`,
	MUTE_REMOVE_FAILED: (userId: string) => `Error removing mute for ${userId}`,
	MUTE_EXPIRED: (guildId: string, userId: string) =>
		`Failed to expire mute ${guildId}:${userId}`,
	MUTE_ROLE_REMOVAL_FAILED: (userId: string) =>
		`Error during role removal for ${userId}`,
	MUTE_EXPIRATION_HANDLER_STARTING:
		"🔄 Initializing mute system and expiration handler",
	MUTE_EXPIRATION_HANDLER_READY: "✅ Mute system expiration handler ready",
	MUTE_EXPIRATION_HANDLER_FAILED:
		"❌ Failed to initialize mute expiration handler",

	// GitHub
	GITHUB_API_ERROR: (status: number, statusText: string) =>
		`⚠️ GitHub API returned ${status} ${statusText}`,
	GITHUB_FETCH_FAILED: "⚠️ Failed to fetch GitHub org info",

	// Error logging
	ERROR_CONTEXT: (context: string) => `[${context}] Error`,
} as const;
