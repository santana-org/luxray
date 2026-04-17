/**
 * Moderation Success Embed Utilities
 *
 * Centralized embed building for moderation command responses:
 * - Consistent formatting across all moderation actions
 * - Type-safe field building
 * - Reusable success message pattern
 *
 * Eliminates ~60+ lines of duplicate embed code
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { sendSuccess } from "./embeds.js";

export interface ModerationSuccessDetails {
	targetUsername: string;
	actionVerb: string; // "Kicked", "Banned", "Muted", "Unbanned", "Unmuted"
	byUsername: string;
	reason?: string | null;
	additionalFields?: Array<{ label: string; value: string; inline?: boolean }>;
}

/**
 * Send standardized moderation success message
 */
export async function sendModerationSuccess(
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
	details: ModerationSuccessDetails,
): Promise<void> {
	const fields: Array<{ label: string; value: string; inline?: boolean }> = [
		{ label: "Member", value: details.targetUsername, inline: true },
		{
			label: `${details.actionVerb} By`,
			value: details.byUsername,
			inline: true,
		},
	];

	// Add reason if provided
	if (details.reason) {
		fields.push({ label: "Reason", value: details.reason, inline: false });
	}

	// Add any additional custom fields
	if (details.additionalFields) {
		fields.push(...details.additionalFields);
	}

	await sendSuccess(interaction, title, description, fields);
}

/**
 * Build moderation success details object
 * (Useful for constructing details programmatically)
 */
export function buildModerationDetails(
	targetUsername: string,
	actionVerb: string,
	byUsername: string,
	reason?: string | null,
	additionalFields?: Array<{ label: string; value: string; inline?: boolean }>,
): ModerationSuccessDetails {
	return {
		targetUsername,
		actionVerb,
		byUsername,
		reason: reason || undefined,
		additionalFields,
	};
}
