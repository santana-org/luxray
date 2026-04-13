/**
 * 🔐 Environment Configuration
 *
 * This module loads and validates Discord bot credentials from .env file.
 * Using 'import "dotenv/config"' at top ensures process.env is populated before
 * any code tries to access config values.
 *
 * Design: Fail-fast on missing required vars (DISCORD_TOKEN, CLIENT_ID).
 * Optional vars (GUILD_ID) default to undefined, enabling both guild-specific and
 * global command registration based on what's configured.
 */

import "dotenv/config";

// Environment variable names - centralized to catch typos at compile time
const ENV_KEYS = {
	DISCORD_TOKEN: "DISCORD_TOKEN",
	CLIENT_ID: "CLIENT_ID",
	GUILD_ID: "GUILD_ID",
	BOT_PREFIX: "BOT_PREFIX",
} as const;

// Default values for optional config with fallbacks
const DEFAULTS = {
	BOT_PREFIX: "!",
} as const;

/**
 * Validate and retrieve required environment variable
 *
 * @param name - Environment variable name (from ENV_KEYS)
 * @returns Value from process.env
 * @throws Error if variable is missing or empty
 *
 * Example error message helps users find the right .env key to set
 */
function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`❌ Missing required environment variable: ${name}`);
	}
	return value;
}

/**
 * Exported config object with TypeScript literal types
 * Using 'as const' enables exhaustiveness checking in consuming code
 * (e.g., if config.guildId is missing, TypeScript knows it could be undefined)
 */
export const config = {
	token: requireEnv(ENV_KEYS.DISCORD_TOKEN),
	clientId: requireEnv(ENV_KEYS.CLIENT_ID),
	// guildId optional: presence enables guild-scoped commands, absence enables global
	guildId: process.env[ENV_KEYS.GUILD_ID],
	prefix: process.env[ENV_KEYS.BOT_PREFIX] ?? DEFAULTS.BOT_PREFIX,
} as const;
