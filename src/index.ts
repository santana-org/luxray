import { client } from './core/client.js';
import { config } from './core/config.js';
import { loadEvents } from './handlers/eventHandler.js';
import { loadCommands } from './handlers/commandHandler.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  await loadEvents(client);
  await loadCommands(client);
  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to start bot', error);
  process.exit(1);
});
