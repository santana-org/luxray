/**
 * 🎯 Command Interface
 *
 * Every slash command must implement this interface.
 * This ensures type safety when commands are loaded dynamically by commandHandler.ts
 *
 * - data: SlashCommandBuilder defining name, description, parameters (Discord validates this)
 * - execute: Async function receiving the user interaction
 */

import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";

export interface Command {
	data: SlashCommandBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
