import type { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

// 🎯 Discord slash command interface
export interface Command {
	data: SlashCommandBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
