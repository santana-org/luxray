import { Client, GatewayIntentBits, Collection } from "discord.js";
import type { Command } from "../types/command.js";

// 🎯 Discord intents configuration
const CLIENT_INTENTS = [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] as const;

export const client = new Client({
	intents: CLIENT_INTENTS,
});

// 🗂️ Initialize commands collection
client.commands = new Collection<string, Command>();

declare module "discord.js" {
	interface Client {
		commands: Collection<string, Command>;
	}
}
