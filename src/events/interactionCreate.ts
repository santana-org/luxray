import { type Interaction } from 'discord.js';
import { client } from '../core/client.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, error);

      const message = { content: 'An error occurred while executing this command.', ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message);
      } else {
        await interaction.reply(message);
      }
    }
  },
};
