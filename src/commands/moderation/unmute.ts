/**
 * 🔊 Unmute Command - Remove Temporary Member Mute
 *
 * Removes the mute role from a member, allowing them to communicate again.
 * Removes tracking record if mute was tracked in the system.
 *
 * Permission checks:
 * - User must have MODERATE_MEMBERS permission
 * - Bot must have MODERATE_MEMBERS permission
 * - Target must currently have mute role
 *
 * Design decisions:
 * - Reason is optional: allows quick unmutes without explanation, or detailed ones with context
 * - DM notification sent after unmute (user may not receive it if they've blocked the bot)
 * - Works regardless of whether the mute was tracked in system or manually applied
 * - Confirmation embed shows who was unmuted, by whom, reason
 */

import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "@/types/command.js";
import {
	sendError,
	sendModerationSuccess,
	validatePermissions,
} from "@/utils/embeds/index.js";
import {
	getMuteRole,
	getMuteRoleId,
	handleModerationError,
	removeMute,
	sendModerationDM,
	validateGuildContext,
} from "@/utils/moderation/index.js";

/**
 * Configuration object for unmute command
 * Centralized for easy i18n and consistent error messaging
 */
const UNMUTE_CONFIG = {
	NAME: "unmute",
	DESCRIPTION: "🔊 Remove mute from a member",
	MESSAGES: {
		NOT_MUTED: "This member is not currently muted.",
		UNMUTE_FAILED: "Failed to unmute member. Please try again.",
		TARGET_NOT_FOUND:
			"This member could not be found (they may have already left).",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /unmute command
 * Requires MODERATE_MEMBERS permission - checked before and during execution
 * Disabled in DMs since members only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(UNMUTE_CONFIG.NAME)
	.setDescription(UNMUTE_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

// Add options to the command
builder.addUserOption((option) =>
	option.setName("member").setDescription("Member to unmute").setRequired(true),
);

builder.addStringOption((option) =>
	option
		.setName("reason")
		.setDescription("Reason for unmute (optional)")
		.setRequired(false)
		.setMaxLength(512),
);

/**
 * Execute /unmute command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate user permissions (MODERATE_MEMBERS)
 * 3. Validate bot permissions (MODERATE_MEMBERS)
 * 4. Get target member
 * 5. Verify member has mute role
 * 6. Remove mute role
 * 7. Clean up tracking record if exists
 * 8. Attempt to notify user via DM
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
			const reason = interaction.options.getString("reason");

			// Get mute role ID from configuration
			const muteRoleId = await getMuteRoleId(interaction);
			if (!muteRoleId) return;

			// Fetch target member
			const targetMember = await interaction.guild?.members
				.fetch(targetUser.id)
				.catch(() => null);

			if (!targetMember) {
				await sendError(
					interaction,
					"Member Not Found",
					UNMUTE_CONFIG.MESSAGES.TARGET_NOT_FOUND,
				);
				return;
			}

			// Check if member has mute role
			if (!targetMember.roles.cache.has(muteRoleId)) {
				await sendError(
					interaction,
					"Not Muted",
					UNMUTE_CONFIG.MESSAGES.NOT_MUTED,
				);
				return;
			}

			// Verify mute role exists
			const muteRole = await getMuteRole(
				interaction.guild as Guild,
				muteRoleId,
				interaction,
			);
			if (!muteRole) return;

			// Remove mute role
			await targetMember.roles.remove(
				muteRole,
				reason ?? "No reason provided by moderator.",
			);

			// Clean up tracking record if exists
			removeMute(interaction.guild?.id ?? "", targetUser.id);

			// Attempt to notify user via DM
			await sendModerationDM(
				targetUser,
				"unmuted",
				interaction.guild?.name ?? "Unknown Server",
				reason,
			);

			// Send success message
			await sendModerationSuccess(
				interaction,
				"Member Unmuted",
				`Successfully unmuted **${targetUser.username}**.`,
				{
					targetUsername: targetUser.username,
					actionVerb: "Unmuted",
					byUsername: interaction.user.username,
					reason,
				},
			);
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"unmute",
				UNMUTE_CONFIG.MESSAGES.UNMUTE_FAILED,
			);
		}
	},
} satisfies Command;
