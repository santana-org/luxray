/**
 * ✅ Unban Command - Revoke Member Ban
 *
 * Removes a member from the server ban list, allowing them to rejoin.
 * Uses Discord's built-in guild.bans.remove() API which creates an audit log entry.
 *
 * Permission checks:
 * - User must have BAN_MEMBERS permission
 * - Bot must have BAN_MEMBERS permission
 * - Target must be currently banned
 *
 * Design decisions:
 * - Reason is optional: allows quick unbans without explanation, or detailed ones with context
 * - DM notification sent after unban (user may not receive it if they've blocked the bot)
 * - All error messages in UNBAN_CONFIG for i18n and consistency
 * - Confirmation embed shows who was unbanned, by whom, reason (if provided)
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "@/types/command.js";
import {
	sendError,
	sendModerationSuccess,
	validatePermissions,
} from "@/utils/embeds/index.js";
import {
	handleModerationError,
	sendModerationDM,
	validateBotPermission,
	validateGuildContext,
	validateModerationTarget,
} from "@/utils/moderation/index.js";

/**
 * Configuration object for unban command
 * Centralized for easy i18n and consistent error messaging
 */
const UNBAN_CONFIG = {
	NAME: "unban",
	DESCRIPTION: "✅ Unban a member so they can rejoin the server",
	MESSAGES: {
		NOT_BANNED: "This member is not currently banned.",
		USER_NOT_FOUND: "User not found. Please provide a valid user ID.",
		UNBAN_FAILED: "Failed to unban member. Please try again.",
		INVALID_USER_ID: "Please provide a valid user ID (18-20 digits).",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /unban command
 * Requires BAN_MEMBERS permission - checked before and during execution
 * Disabled in DMs since bans only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(UNBAN_CONFIG.NAME)
	.setDescription(UNBAN_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

// Add options to the command
builder.addStringOption((option) =>
	option
		.setName("user_id")
		.setDescription("User ID of the banned member")
		.setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("reason")
		.setDescription("Reason for unban (optional)")
		.setRequired(false)
		.setMaxLength(512),
);

/**
 * Execute /unban command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate guild context
 * 3. Validate user permissions (BAN_MEMBERS)
 * 4. Get user ID and reason
 * 5. Validate user ID format
 * 6. Validate bot permissions
 * 7. Check if user is currently banned
 * 8. Fetch user information
 * 9. Validate target (not self or owner)
 * 10. Perform unban with optional reason
 * 11. Attempt to notify user via DM
 * 12. Send success embed with details
 */
export default {
	data: builder,
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Defer reply immediately to prevent interaction timeout if async operations take >3s
		await interaction.deferReply({ ephemeral: true });

		// Validate guild context
		if (!(await validateGuildContext(interaction))) return;

		// Permission check: user must have BAN_MEMBERS
		const hasPermission = await validatePermissions(
			interaction,
			PermissionFlagsBits.BanMembers,
		);
		if (!hasPermission) return;

		try {
			const userIdInput = interaction.options.getString("user_id", true);
			const reason = interaction.options.getString("reason");

			// Validate user ID format (Discord IDs are 17-20 digits)
			if (!/^\d{17,20}$/.test(userIdInput)) {
				await sendError(
					interaction,
					"Invalid User ID",
					UNBAN_CONFIG.MESSAGES.INVALID_USER_ID,
				);
				return;
			}

			// Validate bot has BAN_MEMBERS permission
			if (
				!(await validateBotPermission(
					interaction,
					PermissionFlagsBits.BanMembers,
					"I don't have permission to unban members.",
				))
			) {
				return;
			}

			// Check if user is currently banned
			const bannedUser = await interaction.guild?.bans
				.fetch(userIdInput)
				.catch(() => null);

			if (!bannedUser) {
				await sendError(
					interaction,
					"Not Banned",
					UNBAN_CONFIG.MESSAGES.NOT_BANNED,
				);
				return;
			}

			// Validate target is not self or owner
			if (
				!(await validateModerationTarget(
					interaction,
					userIdInput,
					"unban",
					"You cannot unban yourself.",
					"You cannot unban the server owner.",
				))
			) {
				return;
			}

			// Unban the user
			await interaction.guild?.bans.remove(
				userIdInput,
				reason ?? "No reason provided by moderator.",
			);

			// Attempt to notify user via DM (optional, may fail if DMs are disabled)
			await sendModerationDM(
				bannedUser.user,
				"unbanned",
				interaction.guild?.name ?? "Unknown Server",
				reason,
			);

			// Send success embed
			await sendModerationSuccess(
				interaction,
				"Member Unbanned",
				`Successfully unbanned **${bannedUser.user.username}** from the server.`,
				{
					targetUsername: bannedUser.user.username,
					actionVerb: "Unbanned",
					byUsername: interaction.user.username,
					reason,
				},
			);
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"unban",
				UNBAN_CONFIG.MESSAGES.UNBAN_FAILED,
			);
		}
	},
} satisfies Command;
