import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getSourceExt } from '../utils/paths.js';

interface Event {
  name: string;
  once?: boolean;
  execute(...args: unknown[]): Promise<void> | void;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client: Client): Promise<void> {
  const eventsDir = join(__dirname, '../events');
  const ext = getSourceExt(import.meta.url);
  const files = readdirSync(eventsDir).filter((f) => f.endsWith(ext));

  for (const file of files) {
    const { default: event } = (await import(
      join(eventsDir, file)
    )) as { default: Event };

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    logger.info(`Loaded event: ${event.name}`);
  }
}
