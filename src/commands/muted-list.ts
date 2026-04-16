/**
 * 📋 Muted List Command - Display All Currently Muted Members
 *
 * Lists all members currently muted in the server with:
 * - Time remaining until mute expires
 * - Who muted them
 * - Reason (if provided)
 * - Mute start time
 *
 * Permission checks:
 * - User must have MODERATE_MEMBERS permission
 *
 * Design decisions:
 * - Shows only tracked mutes (those applied via /mute command)
 * - Sorted by time remaining (shortest first)
 * - Pagination support if many users are muted
 * - Paginated display with up to 10 mutes per page
 * - All error messages in LIST_CONFIG for i18n and consistency
 */

import type { ChatInputCommandInteraction } from "discord.js";
import {
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Command } from "@/types/command.js";
import { validatePermissions } from "@/utils/embeds/index.js";
import {
	formatTimeRemaining,
	getMutedUsers,
	handleModerationError,
	toDiscordTimestamp,
	validateGuildContext,
} from "@/utils/moderation/index.js";

/**
 * Configuration object for muted-list command
 * Centralized for easy i18n and consistent error messaging
 */
const LIST_CONFIG = {
	NAME: "muted-list",
	DESCRIPTION: "📋 List all currently muted members",
	MESSAGES: {
		NO_MUTES: "No members are currently muted in this server.",
		LIST_FAILED: "Failed to fetch muted members list. Please try again.",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /muted-list command
 * Requires MODERATE_MEMBERS permission - checked before execution
 * Disabled in DMs since members only exist in servers
 */
const builder = new SlashCommandBuilder()
	.setName(LIST_CONFIG.NAME)
	.setDescription(LIST_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
	.setDMPermission(false);

// Add optional page parameter for pagination
builder.addIntegerOption((option) =>
	option
		.setName("page")
		.setDescription("Page number to display (default: 1)")
		.setRequired(false)
		.setMinValue(1),
);

/**
 * Execute /muted-list command
 *
 * Flow:
 * 1. Defer reply immediately to prevent interaction timeout (3s limit)
 * 2. Validate user permissions (MODERATE_MEMBERS)
 * 3. Get all tracked mutes in guild
 * 4. Check if any mutes exist
 * 5. Paginate and format results
 * 6. Send paginated embed with muted members
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
			const page = interaction.options.getInteger("page") ?? 1;
			const itemsPerPage = 10;

			// Get all muted users in guild
			const mutedUsers = await getMutedUsers(interaction.guild?.id ?? "");

			if (mutedUsers.length === 0) {
				const noMutesEmbed = new EmbedBuilder()
					.setColor(0x3498db)
					.setTitle("📋 Muted Members")
					.setDescription(LIST_CONFIG.MESSAGES.NO_MUTES)
					.setTimestamp();

				await interaction.editReply({ embeds: [noMutesEmbed] });
				return;
			}

			// Calculate pagination
			const totalPages = Math.ceil(mutedUsers.length / itemsPerPage);
			const pageIndex = Math.max(0, Math.min(page - 1, totalPages - 1));
			const startIndex = pageIndex * itemsPerPage;
			const endIndex = startIndex + itemsPerPage;
			const pageItems = mutedUsers.slice(startIndex, endIndex);

			// Build embed
			const embed = new EmbedBuilder()
				.setColor(0x3498db)
				.setTitle("📋 Muted Members")
				.setDescription(
					`Showing ${startIndex + 1}-${Math.min(endIndex, mutedUsers.length)} of ${mutedUsers.length} muted members`,
				)
				.setFooter({
					text: `Page ${pageIndex + 1} of ${totalPages}`,
				})
				.setTimestamp();

			// Add muted users to embed as fields
			for (const record of pageItems) {
				// Fetch user to get username (fallback to ID if unavailable)
				let userDisplay = `<@${record.userId}>`;
				try {
					const user = await interaction.client.users
						.fetch(record.userId)
						.catch(() => null);
					if (user) {
						userDisplay = `${user.username}#${user.discriminator === "0" ? "0000" : user.discriminator}`;
					}
				} catch {
					// Fallback to ID mention if fetch fails
				}

				const timeRemaining = record.muteEndTime - Date.now();
				let fieldValue = `**Muted By:** <@${record.mutedBy}>\n`;
				fieldValue += `**Started:** ${toDiscordTimestamp(record.muteStartTime, "f")}\n`;
				fieldValue += `**Expires In:** ${formatTimeRemaining(timeRemaining)}`;

				if (record.reason) {
					fieldValue += `\n**Reason:** ${record.reason}`;
				}

				embed.addFields({
					name: userDisplay,
					value: fieldValue,
					inline: false,
				});
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleModerationError(
				error,
				interaction,
				"muted-list",
				LIST_CONFIG.MESSAGES.LIST_FAILED,
			);
		}
	},
} satisfies Command;
