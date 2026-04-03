import type { Client } from 'discord.js';
import { logger, LOGS } from '../utils/logger.js';

export default {
  name: 'ready',
  once: true,
  execute(client: Client<true>): void {
    logger.info(LOGS.BOT_READY(client.user.tag));
  },
};
