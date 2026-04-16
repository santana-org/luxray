/**
 * Mute Configuration Utilities
 *
 * Centralized mute role management:
 * - Environment variable validation
 * - Role lookups with error handling
 * - Consistent error messages for missing config
 *
 * Eliminates ~40+ lines of duplicate config code
 */

import type { ChatInputCommandInteraction, Guild, Role } from "discord.js";
import { sendError } from "@/utils/embeds/embeds.js";

/**
 * Get mute role ID from environment with optional error message
 */
export async function getMuteRoleId(
	interaction?: ChatInputCommandInteraction,
): Promise<string | null> {
	const muteRoleId = process.env.MUTE_ROLE_ID;
	if (!muteRoleId && interaction) {
		await sendError(
			interaction,
			"Configuration Error",
			"Mute role is not configured. Please contact server administrators.",
		);
	}
	return muteRoleId ?? null;
}

/**
 * Require mute role ID (throws if not configured)
 * Used in non-command contexts (events, etc.)
 */
export function requireMuteRoleId(): string {
	const muteRoleId = process.env.MUTE_ROLE_ID;
	if (!muteRoleId) {
		throw new Error(
			"MUTE_ROLE_ID environment variable not configured. Please set it in .env file.",
		);
	}
	return muteRoleId;
}

/**
 * Get mute role from guild
 * Uses fetch instead of cache.get to ensure role is always up-to-date
 */
export async function getMuteRole(
	guild: Guild,
	muteRoleId: string,
	interaction?: ChatInputCommandInteraction,
): Promise<Role | null> {
	// Use fetch with force:true to bypass stale cache
	const muteRole = await guild.roles
		.fetch(muteRoleId, { force: true })
		.catch(() => null);
	if (!muteRole && interaction) {
		await sendError(
			interaction,
			"Configuration Error",
			"Mute role not found in this server.",
		);
	}
	return muteRole ?? null;
}

/**
 * Validate mute role is properly configured
 * Checks both environment variable and guild role
 */
export async function validateMuteRoleConfiguration(
	guild: Guild,
	interaction?: ChatInputCommandInteraction,
): Promise<string | null> {
	const muteRoleId = await getMuteRoleId(interaction);
	if (!muteRoleId) return null;

	const muteRole = await getMuteRole(guild, muteRoleId, interaction);
	if (!muteRole) return null;

	return muteRoleId;
}
