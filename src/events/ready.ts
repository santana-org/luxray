import type { Client } from 'discord.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'ready',
  once: true,
  execute(client: Client<true>): void {
    logger.info(`Logged in as ${client.user.tag}`);
  },
};
