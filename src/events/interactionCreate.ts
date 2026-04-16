/**
 * 💬 Interaction Create Event - Slash Command Handler
 *
 * Fires every time user interacts with bot (slash commands, buttons, modals, etc).
 * This handler specifically processes slash commands (ChatInputCommand).
 *
 * Flow:
 * 1. Filter out non-slash-command interactions
 * 2. Lookup command in client.commands collection (loaded by commandHandler)
 * 3. Execute command or log error
 * 4. Catch execution errors and send user feedback
 *
 * Error handling: Both reply() and followUp() paths to handle
 * commands that already replied vs those that deferred or didn't reply yet.
 */

import { Events, type Interaction } from "discord.js";
import { client } from "@/core/client.js";
import { LOGS, logger } from "@/utils/logger/logger.js";

// Error response configuration
const ERROR_RESPONSES = {
	COMMAND_ERROR: "⚠️ An error occurred while executing this command.",
	EPHEMERAL: true, // Only visible to command invoker
} as const;

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction): Promise<void> {
		// Only handle slash commands; ignore buttons, modals, autocomplete, etc.
		if (!interaction.isChatInputCommand()) return;

		const command = client.commands.get(interaction.commandName);

		if (!command) {
			logger.info(LOGS.UNKNOWN_COMMAND(interaction.commandName));
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error(LOGS.COMMAND_ERROR(interaction.commandName), error);

			const message = {
				content: ERROR_RESPONSES.COMMAND_ERROR,
				ephemeral: ERROR_RESPONSES.EPHEMERAL,
			};

			// Command might have already replied or deferred
			// followUp sends as new message, reply would fail if deferred
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(message);
			} else {
				await interaction.reply(message);
			}
		}
	},
};
