/**
 * 🏓 Ping Command - Simple Echo
 *
 * Basic example command demonstrating the Command interface.
 * Replies with "Pong!" to test bot responsiveness and command loading.
 *
 * Use this as a template for new commands:
 * 1. Export default object satisfying Command interface
 * 2. Define SlashCommandBuilder with name/description
 * 3. Implement execute() handler
 * 4. Save file in /commands directory (handler loads automatically)
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "@/types/command.js";

// Command configuration: centralized for i18n-ready architecture
const PING_COMMAND = {
	NAME: "ping",
	DESCRIPTION: "Replies with Pong! 🏓",
	RESPONSE: "🏓 Pong!",
} as const;

export default {
	data: new SlashCommandBuilder()
		.setName(PING_COMMAND.NAME)
		.setDescription(PING_COMMAND.DESCRIPTION),
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.reply(PING_COMMAND.RESPONSE);
	},
} satisfies Command;
