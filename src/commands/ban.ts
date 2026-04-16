/**
 * 🚫 Ban Command - Member Removal with Permanent Ban
 *
 * Removes a member from the server and bans them from rejoining.
 * Uses Discord's built-in member.ban() API which creates an audit log entry.
 *
 * Permission checks:
 * - User must have BAN_MEMBERS permission
 * - Bot must have BAN_MEMBERS permission
 * - Target cannot be server owner
 * - Target role must be lower than bot's highest role (Discord permission hierarchy)
 *
 * Design decisions:
 * - Reason is optional: allows quick bans without explanation, or detailed ones with context
 * - Delete message history is optional (0-604800 seconds = 0-7 days)
 * - DM notification sent before banning as courtesy
 * - All error messages in BAN_CONFIG for i18n and consistency
 * - Confirmation embed shows who was banned, by whom, reason (if provided)
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
	fetchTargetMember,
	handleModerationError,
	sendModerationDM,
	validateBotPermission,
	validateGuildContext,
	validateModerationTarget,
	validateRoleHierarchy,
} from "@/utils/moderation/index.js";

/**
 * Configuration object for ban command
 * Centralized for easy i18n and consistent error messaging
 */
const BAN_CONFIG = {
	NAME: "ban",
	DESCRIPTION: "🚫 Permanently ban a member from the server",
	MESSAGES: {
		INVALID_TARGET: "You cannot ban yourself.",
		TARGET_IS_OWNER: "You cannot ban the server owner.",
		BOT_CANNOT_BAN:
			"I cannot ban this member (their role is higher than mine).",
		USER_CANNOT_BAN:
			"You cannot ban this member (their role is higher than yours).",
		BAN_FAILED: "Failed to ban member. Please try again.",
		TARGET_ALREADY_BANNED: "This member is already banned.",
		TARGET_NOT_FOUND:
			"This member could not be found (they may have already left).",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /ban command
 * Requires BAN_MEMBERS permission - checked before and during execution
 * Disabled in DMs since members only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(BAN_CONFIG.NAME)
	.setDescription(BAN_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
	.setDMPermission(false);

// Add options to the command
builder.addUserOption((option) =>
	option.setName("member").setDescription("Member to ban").setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("reason")
		.setDescription("Reason for ban (optional)")
		.setRequired(false)
		.setMaxLength(512),
);

builder.addIntegerOption((option) =>
	option
		.setName("delete_messages")
		.setDescription(
			"Delete messages from past N seconds (0-7 days, default: 0)",
		)
		.setRequired(false)
		.setMinValue(0)
		.setMaxValue(604800),
);

/**
 * Execute /ban command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate guild context
 * 3. Validate user permissions (BAN_MEMBERS)
 * 4. Get target user and reason
 * 5. Validate target (not self/owner)
 * 6. Validate bot permissions
 * 7. Fetch target member
 * 8. Validate role hierarchy
 * 9. Notify target via DM before ban
 * 10. Perform ban with optional reason and message deletion
 * 11. Send success embed with details
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
			const targetUser = interaction.options.getUser("member", true);
			const reason = interaction.options.getString("reason");
			const deleteMessages =
				interaction.options.getInteger("delete_messages") ?? 0;

			// Validate target is not self or owner
			if (
				!(await validateModerationTarget(
					interaction,
					targetUser.id,
					"ban",
					BAN_CONFIG.MESSAGES.INVALID_TARGET,
					BAN_CONFIG.MESSAGES.TARGET_IS_OWNER,
				))
			) {
				return;
			}

			// Check if already banned
			const existingBan = await interaction.guild?.bans
				.fetch(targetUser.id)
				.catch(() => null);
			if (existingBan) {
				await sendError(
					interaction,
					"Already Banned",
					BAN_CONFIG.MESSAGES.TARGET_ALREADY_BANNED,
				);
				return;
			}

			// Validate bot has BAN_MEMBERS permission
			if (
				!(await validateBotPermission(
					interaction,
					PermissionFlagsBits.BanMembers,
					BAN_CONFIG.MESSAGES.BOT_CANNOT_BAN,
				))
			) {
				return;
			}

			// Try to fetch target member (may not exist if already left)
			const targetMember = await fetchTargetMember(
				interaction,
				targetUser.id,
				BAN_CONFIG.MESSAGES.TARGET_NOT_FOUND,
			);

			// If member exists in guild, validate role hierarchy
			if (targetMember) {
				if (
					!(await validateRoleHierarchy(
						interaction,
						targetMember,
						BAN_CONFIG.MESSAGES.BOT_CANNOT_BAN,
						BAN_CONFIG.MESSAGES.USER_CANNOT_BAN,
					))
				) {
					return;
				}
			}

			// Notify target via DM before banning (best practice for moderation)
			await sendModerationDM(
				targetUser,
				"banned",
				interaction.guild?.name ?? "Unknown Server",
				reason,
			);

			// Perform the ban with optional reason and message deletion
			await interaction.guild?.members.ban(targetUser, {
				reason: reason ?? "No reason provided by moderator.",
				deleteMessageSeconds: deleteMessages,
			});

			// Build additional fields for success message
			const additionalFields = [];
			if (deleteMessages > 0) {
				const days = Math.floor(deleteMessages / 86400);
				additionalFields.push({
					label: "Messages Deleted",
					value: `${days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "< 1 day"}`,
					inline: true,
				});
			}

			// Send success embed
			await sendModerationSuccess(
				interaction,
				"Member Banned",
				`Successfully banned **${targetUser.username}** from the server.`,
				{
					targetUsername: targetUser.username,
					actionVerb: "Banned",
					byUsername: interaction.user.username,
					reason,
					additionalFields:
						additionalFields.length > 0 ? additionalFields : undefined,
				},
			);
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"ban",
				BAN_CONFIG.MESSAGES.BAN_FAILED,
			);
		}
	},
} satisfies Command;
