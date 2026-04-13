import { type Interaction, Events } from "discord.js";
import { client } from "../core/client.js";
import { logger, LOGS } from "../utils/logger.js";

// 💬 Error response configuration
const ERROR_RESPONSES = {
	COMMAND_ERROR: "⚠️ An error occurred while executing this command.",
	EPHEMERAL: true,
} as const;

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction): Promise<void> {
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

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(message);
			} else {
				await interaction.reply(message);
			}
		}
	},
};
