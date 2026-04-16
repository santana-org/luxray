/**
 * 🔇 Mute Command - Temporary Member Muting
 *
 * Applies the mute role to a member for a specified duration.
 * Uses Discord's role system to prevent messaging in most channels.
 *
 * Permission checks:
 * - User must have MODERATE_MEMBERS permission
 * - Bot must have MODERATE_MEMBERS permission
 * - Target cannot be server owner
 * - Target role must be lower than bot's highest role (Discord permission hierarchy)
 *
 * Design decisions:
 * - Duration is required: uses format like "1h", "30m", "2d", "1h30m"
 * - Reason is optional: allows quick mutes without explanation, or detailed ones with context
 * - Mute role ID is configured in environment
 * - DM notification sent before muting as courtesy
 * - Confirmation embed shows who was muted, by whom, duration, reason
 */

import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/command.js";
import { sendModerationDM } from "../utils/dmNotification.js";
import { sendError, validatePermissions } from "../utils/embeds.js";
import { handleModerationError } from "../utils/errorHandler.js";
import { sendModerationSuccess } from "../utils/moderationEmbeds.js";
import {
	fetchTargetMember,
	validateBotPermission,
	validateGuildContext,
	validateModerationTarget,
	validateRoleHierarchy,
} from "../utils/moderationValidation.js";
import { getMuteRole, getMuteRoleId } from "../utils/muteConfig.js";
import { addMute, formatTimeRemaining, parseDuration } from "../utils/mutes.js";

/**
 * Configuration object for mute command
 * Centralized for easy i18n and consistent error messaging
 */
const MUTE_CONFIG = {
	NAME: "mute",
	DESCRIPTION: "🔇 Temporarily mute a member",
	MESSAGES: {
		INVALID_TARGET: "You cannot mute yourself.",
		TARGET_IS_OWNER: "You cannot mute the server owner.",
		BOT_CANNOT_MUTE:
			"I cannot mute this member (their role is higher than mine).",
		USER_CANNOT_MUTE:
			"You cannot mute this member (their role is higher than yours).",
		MUTE_FAILED: "Failed to mute member. Please try again.",
		INVALID_DURATION:
			"Invalid duration format. Use formats like: 1h, 30m, 2d, 1h30m",
		ALREADY_MUTED: "This member is already muted.",
		TARGET_NOT_FOUND:
			"This member could not be found (they may have already left).",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /mute command
 * Requires MODERATE_MEMBERS permission - checked before and during execution
 * Disabled in DMs since members only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(MUTE_CONFIG.NAME)
	.setDescription(MUTE_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
	.setDMPermission(false);

// Add options to the command
builder.addUserOption((option) =>
	option.setName("member").setDescription("Member to mute").setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("duration")
		.setDescription("Duration (e.g., 1h, 30m, 2d, 1h30m)")
		.setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("reason")
		.setDescription("Reason for mute (optional)")
		.setRequired(false)
		.setMaxLength(512),
);

/**
 * Execute /mute command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate user permissions (MODERATE_MEMBERS)
 * 3. Validate bot permissions (MODERATE_MEMBERS)
 * 4. Parse duration from input
 * 5. Get target member and validate hierarchy
 * 6. Check if already muted
 * 7. Apply mute role and record in tracking system
 * 8. Notify target via DM before muting
 * 9. Send success embed with details
 */
export default {
	data: builder,
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Defer reply immediately to prevent interaction timeout if async operations take >3s
		await interaction.deferReply({ ephemeral: true });

		// Validate guild context
		if (!(await validateGuildContext(interaction))) return;

		// Permission check: user must have MODERATE_MEMBERS
		const hasPermission = await validatePermissions(
			interaction,
			PermissionFlagsBits.ModerateMembers,
		);
		if (!hasPermission) return;

		try {
			const targetUser = interaction.options.getUser("member", true);
			const durationStr = interaction.options.getString("duration", true);
			const reason = interaction.options.getString("reason");

			// Get mute role ID from configuration
			const muteRoleId = await getMuteRoleId(interaction);
			if (!muteRoleId) return;

			// Parse duration
			const durationMs = parseDuration(durationStr);
			if (!durationMs) {
				await sendError(
					interaction,
					"Invalid Duration",
					MUTE_CONFIG.MESSAGES.INVALID_DURATION,
				);
				return;
			}

			// Validate target (not self, not owner)
			if (
				!(await validateModerationTarget(
					interaction,
					targetUser.id,
					"mute",
					MUTE_CONFIG.MESSAGES.INVALID_TARGET,
					MUTE_CONFIG.MESSAGES.TARGET_IS_OWNER,
				))
			) {
				return;
			}

			// Validate bot has permission
			if (
				!(await validateBotPermission(
					interaction,
					PermissionFlagsBits.ModerateMembers,
					MUTE_CONFIG.MESSAGES.BOT_CANNOT_MUTE,
				))
			) {
				return;
			}

			// Fetch target member
			const targetMember = await fetchTargetMember(
				interaction,
				targetUser.id,
				MUTE_CONFIG.MESSAGES.TARGET_NOT_FOUND,
			);
			if (!targetMember) return;

			// Validate role hierarchy
			if (
				!(await validateRoleHierarchy(
					interaction,
					targetMember,
					MUTE_CONFIG.MESSAGES.BOT_CANNOT_MUTE,
					MUTE_CONFIG.MESSAGES.USER_CANNOT_MUTE,
				))
			) {
				return;
			}

			// Check mute role exists and target doesn't already have it
			const muteRole = await getMuteRole(
				interaction.guild as Guild,
				muteRoleId,
				interaction,
			);
			if (!muteRole) return;

			if (targetMember.roles.cache.has(muteRoleId)) {
				await sendError(
					interaction,
					"Already Muted",
					MUTE_CONFIG.MESSAGES.ALREADY_MUTED,
				);
				return;
			}

			// Notify target via DM before applying mute
			const durationFormatted = formatTimeRemaining(durationMs);
			await sendModerationDM(
				targetUser,
				"muted",
				interaction.guild?.name ?? "Unknown Server",
				reason,
				`for ${durationFormatted}`,
			);

			// Apply mute role after DM notification (so notification always succeeds)
			await targetMember.roles.add(
				muteRole,
				reason ?? "No reason provided by moderator.",
			);

			// Record mute in tracking system and schedule expiration
			await addMute(
				interaction.guild?.id ?? "",
				targetUser.id,
				interaction.user.id,
				durationMs,
				reason,
				interaction.client,
				muteRoleId,
			);

			// Send success message
			await sendModerationSuccess(
				interaction,
				"Member Muted",
				`Successfully muted **${targetUser.username}**.`,
				{
					targetUsername: targetUser.username,
					actionVerb: "Muted",
					byUsername: interaction.user.username,
					reason,
					additionalFields: [
						{ label: "Duration", value: durationFormatted, inline: true },
					],
				},
			);
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"mute",
				MUTE_CONFIG.MESSAGES.MUTE_FAILED,
			);
		}
	},
} satisfies Command;
