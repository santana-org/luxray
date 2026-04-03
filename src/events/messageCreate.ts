import { type Message } from 'discord.js';
import { config } from '../core/config.js';
import { logger } from '../utils/logger.js';

type PrefixCommandHandler = (message: Message, args: string[]) => Promise<void>;

const prefixCommands = new Map<string, PrefixCommandHandler>([
  ['ping', async (message) => { await message.reply('Pong!'); }],
]);

export default {
  name: 'messageCreate',
  async execute(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const handler = prefixCommands.get(commandName);

    if (!handler) {
      logger.info(`Unknown prefix command: ${commandName}`);
      return;
    }

    try {
      await handler(message, args);
    } catch (error) {
      logger.error(`Error executing prefix command: ${commandName}`, error);
    }
  },
};
