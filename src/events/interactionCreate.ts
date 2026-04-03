import { type Interaction } from 'discord.js';
import { client } from '../core/client.js';
import { logger, LOGS } from '../utils/logger.js';

export default {
  name: 'interactionCreate',
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

      const message = { content: 'An error occurred while executing this command.', ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message);
      } else {
        await interaction.reply(message);
      }
    }
  },
};
