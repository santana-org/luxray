import { type Message, Events } from 'discord.js';
import { config } from '../core/config.js';
import { logger, LOGS } from '../utils/logger.js';

type PrefixCommandHandler = (message: Message, args: string[]) => Promise<void>;

const prefixCommands = new Map<string, PrefixCommandHandler>([
  ['ping', async (message) => { await message.reply('Pong!'); }],
]);

export default {
  name: Events.MessageCreate,
  async execute(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
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
