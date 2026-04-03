import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { Command } from '../types/command.js';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection<string, Command>();

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
