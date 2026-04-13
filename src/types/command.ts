import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";

// 🎯 Discord slash command interface
export interface Command {
	data: SlashCommandBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
