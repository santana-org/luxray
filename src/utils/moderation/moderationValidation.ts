/**
 * Moderation Command Validation Utilities
 *
 * Centralized validation logic for all moderation commands:
 * - Self/owner target prevention
 * - Role hierarchy checking
 * - Bot permission validation
 * - Member fetching with error handling
 * - Guild context validation
 *
 * Eliminates ~150+ lines of duplicate code across commands
 */

import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { sendError } from "@/utils/embeds/embeds.js";

/**
 * Validate target is not self or server owner
 */
export async function validateModerationTarget(
	interaction: ChatInputCommandInteraction,
	targetUserId: string,
	actionName: string, // "kick", "ban", "mute"
	selfErrorMessage: string,
	ownerErrorMessage: string,
): Promise<boolean> {
	// Check self-targeting
	if (targetUserId === interaction.user.id) {
		await sendError(interaction, "Invalid Target", selfErrorMessage);
		return false;
	}

	// Check owner targeting
	if (targetUserId === interaction.guild?.ownerId) {
		await sendError(
			interaction,
			`Cannot ${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Owner`,
			ownerErrorMessage,
		);
		return false;
	}

	return true;
}

/**
 * Validate role hierarchy (bot and user vs target)
 */
export async function validateRoleHierarchy(
	interaction: ChatInputCommandInteraction,
	targetMember: GuildMember,
	botErrorMessage: string,
	userErrorMessage: string,
): Promise<boolean> {
	const botMember = interaction.guild?.members.me;
	if (!botMember) return false;
	const userMember = interaction.member as GuildMember;

	// Check bot can interact with target
	if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
		await sendError(interaction, "Missing Permissions", botErrorMessage);
		return false;
	}

	// Check user can interact with target
	if (
		userMember.roles.highest.position <= targetMember.roles.highest.position
	) {
		await sendError(interaction, "Insufficient Permissions", userErrorMessage);
		return false;
	}

	return true;
}

/**
 * Validate bot has required permission
 */
export async function validateBotPermission(
	interaction: ChatInputCommandInteraction,
	permission: bigint,
	errorMessage: string,
): Promise<GuildMember | null> {
	const botMember = interaction.guild?.members.me;

	if (!botMember?.permissions.has(permission)) {
		await sendError(interaction, "Missing Permissions", errorMessage);
		return null;
	}

	return botMember;
}

/**
 * Fetch target member with error handling
 */
export async function fetchTargetMember(
	interaction: ChatInputCommandInteraction,
	targetUserId: string,
	notFoundMessage: string,
): Promise<GuildMember | null> {
	try {
		const member = await interaction.guild?.members
			.fetch(targetUserId)
			.catch(() => null);

		if (!member) {
			await sendError(interaction, "Member Not Found", notFoundMessage);
			return null;
		}

		return member;
	} catch (_err) {
		await sendError(interaction, "Member Not Found", notFoundMessage);
		return null;
	}
}

/**
 * Validate command is used in guild context
 */
export async function validateGuildContext(
	interaction: ChatInputCommandInteraction,
): Promise<boolean> {
	if (!interaction.guild) {
		await sendError(
			interaction,
			"Invalid Context",
			"This command can only be used in a server.",
		);
		return false;
	}
	return true;
}

/**
 * Validate user has moderation permission
 * (Called before other checks since it's the baseline)
 */
export async function validateModerationPermission(
	interaction: ChatInputCommandInteraction,
	permission: bigint,
): Promise<boolean> {
	// This uses the existing validatePermissions from embeds.ts
	// Just a wrapper for consistency
	const userMember = interaction.member as GuildMember;

	if (!userMember.permissions.has(permission)) {
		await sendError(
			interaction,
			"Missing Permissions",
			`You don't have permission to use this command.`,
		);
		return false;
	}

	return true;
}
