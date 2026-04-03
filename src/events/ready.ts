import type { Client } from 'discord.js';
import { logger, LOGS } from '../utils/logger.js';

export default {
  name: 'clientReady',
  once: true,
  execute(client: Client<true>): void {
    logger.info(LOGS.BOT_READY(client.user.tag));
  },
};
