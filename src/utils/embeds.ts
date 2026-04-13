/**
 * Centralized embed factory and helpers for consistent UI across commands
 *
 * Design: All embeds follow color-coding (success=green, error=red, warning=yellow, info=blue)
 * to provide immediate visual feedback to users. Using this module ensures consistency
 * and makes it easy to update styling globally.
 *
 * Each helper is a curried factory: validates input, builds embed, calls editReply()
 * This keeps handlers clean by delegating UI rendering
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";

// Color palette: standardized across all responses
// Each color signals intent to user: success (green), error (red), warning (yellow), info (blue)
const EMBED_COLORS = {
	SUCCESS: 0x57f287,
	ERROR: 0xed4245,
	WARNING: 0xfaa61a,
	INFO: 0x5865f2,
} as const;

/**
 * Create base embed with color
 *
 * @param type - Embed type determines color and context
 * @returns EmbedBuilder ready for title/description/fields
 */
export const createEmbed = (type: "success" | "error" | "warning" | "info") => {
	const colors = {
		success: EMBED_COLORS.SUCCESS,
		error: EMBED_COLORS.ERROR,
		warning: EMBED_COLORS.WARNING,
		info: EMBED_COLORS.INFO,
	};
	return new EmbedBuilder().setColor(colors[type]);
};

/**
 * Send success embed with optional detail fields
 *
 * Details array allows showing metadata (e.g. message count, filter applied) in formatted rows
 */
export const sendSuccess = async (
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
	details?: Array<{ label: string; value: string; inline?: boolean }>,
): Promise<void> => {
	const embed = createEmbed("success")
		.setTitle(title)
		.setDescription(description);

	if (details) {
		details.forEach(({ label, value, inline }) => {
			embed.addFields({ name: label, value, inline });
		});
	}

	await interaction.editReply({ embeds: [embed] });
};

/**
 * Send error embed
 *
 * Used when operation fails or validation fails
 */
export const sendError = async (
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
): Promise<void> => {
	const embed = createEmbed("error")
		.setTitle(title)
		.setDescription(description);
	await interaction.editReply({ embeds: [embed] });
};

/**
 * Send warning embed
 *
 * Used for non-critical issues (e.g., no matching messages found)
 */
export const sendWarning = async (
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
): Promise<void> => {
	const embed = createEmbed("warning")
		.setTitle(title)
		.setDescription(description);
	await interaction.editReply({ embeds: [embed] });
};

/**
 * Send info embed with optional detail fields
 *
 * Similar to sendSuccess but signals information rather than action completion
 */
export const sendInfo = async (
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
	details?: Array<{ label: string; value: string; inline?: boolean }>,
): Promise<void> => {
	const embed = createEmbed("info").setTitle(title).setDescription(description);

	if (details) {
		details.forEach(({ label, value, inline }) => {
			embed.addFields({ name: label, value, inline });
		});
	}

	await interaction.editReply({ embeds: [embed] });
};

/**
 * Validate both user and bot have required permissions
 *
 * This prevents wasted API calls: if bot can't execute, fail fast with clear message
 * Defaults to ManageMessages for delete operations
 */
export const validatePermissions = async (
	interaction: ChatInputCommandInteraction,
	permission: bigint = PermissionFlagsBits.ManageMessages,
): Promise<boolean> => {
	if (!interaction.memberPermissions?.has(permission)) {
		const embed = createEmbed("error")
			.setTitle("Permission Denied")
			.setDescription(`You need the required permissions to use this command.`);

		await interaction.reply({ embeds: [embed], ephemeral: true });
		return false;
	}

	if (!interaction.guild?.members.me?.permissions.has(permission)) {
		const embed = createEmbed("error")
			.setTitle("Missing Permissions")
			.setDescription(
				`I need the required permissions to execute this command.`,
			);

		await interaction.reply({ embeds: [embed], ephemeral: true });
		return false;
	}

	return true;
};

/**
 * Check if channel supports bulkDelete operation
 *
 * Not all channel types support bulk operations
 * This is a simple guard; getTextChannel() in handlers adds instanceof check for type safety
 */
export const isValidChannel = (
	interaction: ChatInputCommandInteraction,
): boolean => {
	return interaction.channel !== null && "bulkDelete" in interaction.channel;
};

/**
 * Helper to create warning embed for confirmation dialogs
 *
 * Pre-configured for destructive action confirmations (e.g., /clear all)
 */
export const createWarningEmbed = (title: string, description: string) => {
	return createEmbed("warning").setTitle(title).setDescription(description);
};
