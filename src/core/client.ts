/**
 * 🎯 Discord.js Client Factory
 *
 * This module initializes the Discord client with specific intents needed for this bot.
 * Using minimal intents improves performance and reduces memory footprint.
 *
 * Intents selected:
 * - Guilds: Receive guild/server structure updates
 * - GuildMessages: Receive events for messages in guilds (needed for prefix commands)
 * - MessageContent: Access message.content property (privileged intent - requires bot activation)
 */

import { Client, Collection, GatewayIntentBits } from "discord.js";
import type { Command } from "../types/command.js";

// Minimal intents for functionality: reject Guilds returns no events
// MessageContent is privileged: must be enabled in Discord Developer Portal
const CLIENT_INTENTS = [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] as const;

export const client = new Client({
	intents: CLIENT_INTENTS,
});

/**
 * Custom commands collection
 * Populated by commandHandler.ts during bot startup
 * Accessed by interactionCreate.ts when user runs a slash command
 *
 * Using Collection<string, Command> instead of plain object for:
 * - Type safety (discriminated by command name)
 * - Built-in iteration/filtering methods
 * - Consistency with Discord.js patterns
 */
client.commands = new Collection<string, Command>();

// Module augmentation: tell TypeScript that Client has a commands property
declare module "discord.js" {
	interface Client {
		commands: Collection<string, Command>;
	}
}
