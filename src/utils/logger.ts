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
	BOT_READY: (tag: string) => `🤖 Bot ready — logged in as ${tag}`,
	EVENTS_LOADED: (count: number) => `📡 Events loaded: ${count}`,
	COMMANDS_LOADED: (count: number) => `🔧 Commands loaded: ${count}`,
	COMMANDS_REGISTERED: (count: number, scope: string) =>
		`✅ Slash commands registered: ${count} (${scope})`,
	BOOT_FAILED: "❌ Failed to start bot",
	UNKNOWN_COMMAND: (name: string) => `❓ Unknown slash command: ${name}`,
	COMMAND_ERROR: (name: string) => `⚡ Error in slash command: ${name}`,
	UNKNOWN_PREFIX_CMD: (name: string) => `❓ Unknown prefix command: ${name}`,
	PREFIX_CMD_ERROR: (name: string) => `⚡ Error in prefix command: ${name}`,
} as const;
