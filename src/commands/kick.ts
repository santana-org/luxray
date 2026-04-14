/**
 * 👢 Kick Command - Member Removal with Audit Logging
 *
 * Removes a member from the server with optional reason.
 * Uses Discord's built-in member.kick() API which creates an audit log entry.
 *
 * Permission checks:
 * - User must have KICK_MEMBERS permission
 * - Bot must have KICK_MEMBERS permission
 * - Target cannot be server owner
 * - Target role must be lower than bot's highest role (Discord permission hierarchy)
 *
 * Design decisions:
 * - Reason is optional: allows quick kicks without explanation, or detailed ones with context
 * - All error messages in KICK_CONFIG for i18n and consistency
 * - Uses logError() for unexpected failures (helps debugging)
 * - Confirmation embed shows who was kicked, by whom, reason (if provided)
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/command.js";
import { sendModerationDM } from "../utils/dmNotification.js";
import { validatePermissions } from "../utils/embeds.js";
import { handleModerationError } from "../utils/errorHandler.js";
import { sendModerationSuccess } from "../utils/moderationEmbeds.js";
import {
	fetchTargetMember,
	validateBotPermission,
	validateGuildContext,
	validateModerationTarget,
	validateRoleHierarchy,
} from "../utils/moderationValidation.js";

/**
 * Configuration object for kick command
 * Centralized for easy i18n and consistent error messaging
 */
const KICK_CONFIG = {
	NAME: "kick",
	DESCRIPTION: "👢 Remove a member from the server",
	MESSAGES: {
		INVALID_TARGET: "You cannot kick yourself.",
		TARGET_IS_OWNER: "You cannot kick the server owner.",
		BOT_CANNOT_KICK:
			"I cannot kick this member (their role is higher than mine).",
		USER_CANNOT_KICK:
			"You cannot kick this member (their role is higher than yours).",
		KICK_FAILED: "Failed to kick member. Please try again.",
		TARGET_ALREADY_LEFT: "This member has already left the server.",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /kick command
 * Requires KICK_MEMBERS permission - checked before and during execution
 * Disabled in DMs since members only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(KICK_CONFIG.NAME)
	.setDescription(KICK_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
	.setDMPermission(false);

// Add options to the command
builder.addUserOption((option) =>
	option.setName("member").setDescription("Member to kick").setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("reason")
		.setDescription("Reason for kick (optional)")
		.setRequired(false)
		.setMaxLength(512),
);

/**
 * Execute /kick command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate user permissions (KICK_MEMBERS)
 * 3. Validate bot permissions (KICK_MEMBERS)
 * 4. Get target member and validate hierarchy
 * 5. Notify target via DM before kick
 * 6. Perform kick with optional reason
 * 7. Send success embed with details
 */
export default {
	data: builder,
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Defer reply immediately to prevent interaction timeout if async operations take >3s
		await interaction.deferReply({ ephemeral: true });

		// Validate guild context
		if (!(await validateGuildContext(interaction))) return;

		// Permission check: user must have KICK_MEMBERS
		const hasPermission = await validatePermissions(
			interaction,
			PermissionFlagsBits.KickMembers,
		);
		if (!hasPermission) return;

		try {
			const targetUser = interaction.options.getUser("member", true);
			const reason = interaction.options.getString("reason");

			// Validate target (not self, not owner)
			if (
				!(await validateModerationTarget(
					interaction,
					targetUser.id,
					"kick",
					KICK_CONFIG.MESSAGES.INVALID_TARGET,
					KICK_CONFIG.MESSAGES.TARGET_IS_OWNER,
				))
			) {
				return;
			}

			// Validate bot has permission
			if (
				!(await validateBotPermission(
					interaction,
					PermissionFlagsBits.KickMembers,
					KICK_CONFIG.MESSAGES.BOT_CANNOT_KICK,
				))
			) {
				return;
			}

			// Fetch target member
			const targetMember = await fetchTargetMember(
				interaction,
				targetUser.id,
				KICK_CONFIG.MESSAGES.TARGET_ALREADY_LEFT,
			);
			if (!targetMember) return;

			// Validate role hierarchy
			if (
				!(await validateRoleHierarchy(
					interaction,
					targetMember,
					KICK_CONFIG.MESSAGES.BOT_CANNOT_KICK,
					KICK_CONFIG.MESSAGES.USER_CANNOT_KICK,
				))
			) {
				return;
			}

			// Notify target via DM before kicking
			await sendModerationDM(
				targetUser,
				"kicked",
				interaction.guild?.name ?? "Unknown Server",
				reason,
			);

			// Perform the kick with optional reason in audit log
			await targetMember.kick(reason ?? "No reason provided by moderator.");

			// Send success message
			await sendModerationSuccess(
				interaction,
				"Member Kicked",
				`Successfully removed **${targetUser.username}** from the server.`,
				{
					targetUsername: targetUser.username,
					actionVerb: "Kicked",
					byUsername: interaction.user.username,
					reason,
				},
			);
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"kick",
				KICK_CONFIG.MESSAGES.KICK_FAILED,
			);
		}
	},
} satisfies Command;
