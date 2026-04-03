import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import type { Client, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { Command } from '../types/command.js';
import { config } from '../core/config.js';
import { logger, LOGS } from '../utils/logger.js';
import { getSourceExt, walkDir } from '../utils/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Client): Promise<void> {
  const commandsDir = join(__dirname, '../commands');
  const ext = getSourceExt(import.meta.url);
  const files = walkDir(commandsDir, ext);
  const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  for (const file of files) {
    const { default: command } = (await import(file)) as { default: Command };
    client.commands.set(command.data.name, command);
    commandData.push(command.data.toJSON());
  }

  logger.info(LOGS.COMMANDS_LOADED(files.length));
  await registerCommands(commandData);
}

async function registerCommands(
  commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
): Promise<void> {
  const rest = new REST().setToken(config.token);

  const scope = config.guildId ? 'guild' : 'global';
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  logger.info(LOGS.COMMANDS_REGISTERED(commands.length, scope));
}
