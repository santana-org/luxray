import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import type { Client, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { Command } from '../types/command.js';
import { config } from '../core/config.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Client): Promise<void> {
  const commandsDir = join(__dirname, '../commands');
  const files = readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
  const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  for (const file of files) {
    const { default: command } = (await import(
      join(commandsDir, file)
    )) as { default: Command };

    client.commands.set(command.data.name, command);
    commandData.push(command.data.toJSON());
    logger.info(`Loaded command: ${command.data.name}`);
  }

  await registerCommands(commandData);
}

async function registerCommands(
  commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
): Promise<void> {
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  logger.info(`Registered ${commands.length} slash command(s).`);
}
