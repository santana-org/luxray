/**
 * 🔧 Command Handler - Dynamic Loader
 *
 * Scans /commands directory, imports all .ts/.js files as Command modules,
 * registers them in client.commands collection, then syncs with Discord API.
 *
 * Design: Decouples command loading from client - commands are just
 * { data: SlashCommandBuilder, execute: function } objects.
 * New commands require only creating a file; no handler changes needed.
 *
 * Scope decision:
 * - If GUILD_ID set: Commands registered to guild (dev mode - instant deploy)
 * - If GUILD_ID not set: Commands global (production - 1hr caching by Discord)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	Client,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { REST, Routes } from "discord.js";
import { config } from "@/core/config.js";
import type { Command } from "@/types/command.js";
import { getSourceExt, walkDir } from "@/utils/common/index.js";
import { LOGS, logger } from "@/utils/logger/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration for command discovery and registration
const COMMAND_CONFIG = {
	BASE_DIR: "../commands",
	SCOPE_GUILD: "guild",
	SCOPE_GLOBAL: "global",
} as const;

/**
 * Load all commands from disk and register with Discord
 *
 * @param client - Discord.js Client instance with empty commands collection
 *
 * Steps:
 * 1. Scan commands directory recursively
 * 2. Dynamic import each file
 * 3. Register Command in client.commands collection
 * 4. Extract SlashCommandBuilder data
 * 5. Sync all to Discord API
 */
export async function loadCommands(client: Client): Promise<void> {
	const commandsDir = join(__dirname, COMMAND_CONFIG.BASE_DIR);
	const ext = getSourceExt(import.meta.url);
	const files = walkDir(commandsDir, ext);
	const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

	for (const file of files) {
		const { default: command } = (await import(file)) as { default: Command };
		client.commands.set(command.data.name, command);
		commandData.push(command.data.toJSON());
	}

	logger.info(LOGS.COMMANDS_LOADED(files.length));
	await registerCommands(commandData);
}

/**
 * Register commands with Discord API
 *
 * This is where your commands become visible to users.
 * Discord validates SlashCommandBuilder structure and returns errors
 * if anything is malformed (missing descriptions, invalid names, etc).
 *
 * @param commands - Array of SlashCommandBuilder.toJSON() results
 */
async function registerCommands(
	commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
): Promise<void> {
	const rest = new REST().setToken(config.token);

	// Choose scope based on environment: guild (dev/testing) vs global (production)
	const scope = config.guildId
		? COMMAND_CONFIG.SCOPE_GUILD
		: COMMAND_CONFIG.SCOPE_GLOBAL;
	const route = config.guildId
		? Routes.applicationGuildCommands(config.clientId, config.guildId)
		: Routes.applicationCommands(config.clientId);

	await rest.put(route, { body: commands });
	logger.info(LOGS.COMMANDS_REGISTERED(commands.length, scope));
}
