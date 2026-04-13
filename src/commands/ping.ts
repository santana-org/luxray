import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/command.js";

// 🏓 Ping command configuration
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
