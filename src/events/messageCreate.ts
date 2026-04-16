/**
 * 📝 Message Create Event - Prefix Command Handler
 *
 * Fires every time a message is sent in a server the bot can see.
 * This handler implements legacy "prefix" commands (e.g., "!ping") as fallback
 * to modern slash commands (/ping).
 *
 * Prefix commands are older Discord style but still useful for:
 * - Quick testing during development
 * - Accessibility in contexts where slash commands aren't ideal
 * - Custom command responses
 *
 * Flow:
 * 1. Ignore bot messages (prevent loops)
 * 2. Check if message starts with configured prefix (default: "!")
 * 3. Parse command name and arguments
 * 4. Lookup and execute handler from Map
 * 5. Log errors (but don't reply - silent fail is often expected for typos)
 */

import { Events, type Message } from "discord.js";
import { config } from "@/core/config.js";
import { LOGS, logger } from "@/utils/logger/logger.js";

// Response messages for prefix commands
const PREFIX_RESPONSES = {
	PING_PONG: "🏓 Pong!",
} as const;

// Prefix command handler signature: receives message and parsed arguments
type PrefixCommandHandler = (message: Message, args: string[]) => Promise<void>;

/**
 * Registry of all prefix commands
 * Key: command name (lowercase)
 * Value: async handler function
 *
 * Adding new prefix commands:
 * 1. Add handler to this Map with command name
 * 2. Handler receives message (can use msg.reply, msg.react, etc) and args array
 * 3. Done - no other changes needed
 */
const prefixCommands = new Map<string, PrefixCommandHandler>([
	[
		"ping",
		async (message) => {
			await message.reply(PREFIX_RESPONSES.PING_PONG);
		},
	],
]);

export default {
	name: Events.MessageCreate,
	async execute(message: Message): Promise<void> {
		// Ignore bot messages to prevent command loops
		if (message.author.bot) return;
		// Ignore messages that don't start with prefix
		if (!message.content.startsWith(config.prefix)) return;

		// Parse: "!ping hello world" => args = ["ping", "hello", "world"]
		const args = message.content
			.slice(config.prefix.length)
			.trim()
			.split(/\s+/);
		const commandName = args.shift()?.toLowerCase();

		if (!commandName) return;

		const handler = prefixCommands.get(commandName);

		if (!handler) {
			logger.info(LOGS.UNKNOWN_PREFIX_CMD(commandName));
			return;
		}

		try {
			await handler(message, args);
		} catch (error) {
			logger.error(LOGS.PREFIX_CMD_ERROR(commandName), error);
		}
	},
};
