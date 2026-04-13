import "dotenv/config";

// 🔑 Environment variable names
const ENV_KEYS = {
	DISCORD_TOKEN: "DISCORD_TOKEN",
	CLIENT_ID: "CLIENT_ID",
	GUILD_ID: "GUILD_ID",
	BOT_PREFIX: "BOT_PREFIX",
} as const;

// 🎛️ Default configuration values
const DEFAULTS = {
	BOT_PREFIX: "!",
} as const;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`❌ Missing required environment variable: ${name}`);
	}
	return value;
}

export const config = {
	token: requireEnv(ENV_KEYS.DISCORD_TOKEN),
	clientId: requireEnv(ENV_KEYS.CLIENT_ID),
	guildId: process.env[ENV_KEYS.GUILD_ID],
	prefix: process.env[ENV_KEYS.BOT_PREFIX] ?? DEFAULTS.BOT_PREFIX,
} as const;
