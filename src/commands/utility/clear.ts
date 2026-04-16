/**
 * 🧹 Clear Command - Bulk message deletion with flexible filtering
 *
 * Provides three main operations:
 * - amount: Delete a fixed number of recent messages
 * - filter: Delete messages matching criteria (user, bot, date, keyword, images, links)
 * - all: Delete all messages with confirmation buttons to prevent accidents
 *
 * Uses Discord.js TextChannel.bulkDelete() API which supports messages up to 14 days old.
 * Older messages must be deleted individually (not implemented to avoid rate limiting).
 *
 * Design decisions:
 * - Consolidated 8 options into 3 subcommands for better UX
 * - Filter type uses string choices (dropdown menu) for discoverability
 * - Confirmation dialog with 15s timeout on /clear all to prevent mass deletion accidents
 * - Timestamp-aware date filtering (UTC) to handle timezone differences
 * - All error messages in one config object for i18n-ready architecture
 */

import type { ChatInputCommandInteraction, Message } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TextChannel,
} from "discord.js";
import type { Command } from "@/types/command.js";
import { escapeMd } from "@/utils/common/common.js";
import {
	applyFilter,
	filters,
	logError,
} from "@/utils/common/messageFilters.js";
import {
	createWarningEmbed,
	sendError,
	sendSuccess,
	sendWarning,
	validatePermissions,
} from "@/utils/embeds/embeds.js";

/**
 * Centralized configuration for the clear command
 * Using as const for TypeScript literal type inference
 * Enables easy i18n by centralizing all user-facing strings
 */
const CLEAR_CONFIG = {
	NAME: "clear",
	DESCRIPTION: "🧹 Clean messages from the channel",
	LIMITS: {
		MIN: 1,
		MAX: 100,
		DISCORD_FETCH: 100,
	},
	MESSAGES: {
		INVALID_CHANNEL: "This channel type doesn't support message deletion.",
		INVALID_DATE_FORMAT:
			"Please use the format **YYYY-MM-DD** (e.g., 2024-01-15).",
		INVALID_DATE: "The date provided is invalid. Please try again.",
		NO_MESSAGES: "No messages found matching the criteria.",
		DELETION_FAILED:
			"Unable to delete messages. Messages may be older than 14 days or Discord rate limit reached.",
		ALL_CONFIRM:
			"Are you sure you want to delete all messages? This cannot be undone!",
		TIMEOUT: "Confirmation timed out. Operation cancelled.",
	},
} as const;

/**
 * Discord.js SlashCommandBuilder for /clear command
 * Requires ManageMessages permission - checked before execution
 * Disabled in DMs since bulk operations only work in channels
 */
const builder = new SlashCommandBuilder()
	.setName(CLEAR_CONFIG.NAME)
	.setDescription(CLEAR_CONFIG.DESCRIPTION)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

// Subcommand 1: amount - Delete fixed number of recent messages
// Discord.bulkDelete() API optimizes this for performance
builder.addSubcommand((subcommand) =>
	subcommand
		.setName("amount")
		.setDescription("Delete a specific number of messages")
		.addIntegerOption((option) =>
			option
				.setName("count")
				.setDescription("Number of messages to delete (1-100)")
				.setRequired(true)
				.setMinValue(CLEAR_CONFIG.LIMITS.MIN)
				.setMaxValue(CLEAR_CONFIG.LIMITS.MAX),
		),
);

/**
 * Subcommand 2: filter - Flexible message deletion with various criteria
 * Uses string choices (dropdown) for discoverability and type safety
 * Each filter type has optional parameters (only required ones are used)
 * This approach scales well: adding new filters only requires:
 *   1. Add choice to addChoices()
 *   2. Add case in handleFilter() switch
 *   3. Add filter function to messageFilters.ts
 */
builder.addSubcommand((subcommand) =>
	subcommand
		.setName("filter")
		.setDescription(
			"Delete messages by filter (user, bot, date, contains, images, links)",
		)
		.addStringOption((option) =>
			option
				.setName("type")
				.setDescription("Filter type")
				.setRequired(true)
				.addChoices(
					{ name: "User", value: "user" },
					{ name: "Bot messages", value: "bot" },
					{ name: "By date", value: "date" },
					{ name: "Contains keyword", value: "contains" },
					{ name: "With images", value: "images" },
					{ name: "With links", value: "links" },
				),
		)
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("User to filter by (for type: user)"),
		)
		.addStringOption((option) =>
			option
				.setName("date")
				.setDescription(
					"Date to filter by (for type: date) - Format: YYYY-MM-DD",
				),
		)
		.addStringOption((option) =>
			option
				.setName("keyword")
				.setDescription("Keyword to search for (for type: contains)"),
		)
		.addIntegerOption((option) =>
			option
				.setName("limit")
				.setDescription("Maximum messages to search (1-100, default: 100)")
				.setMinValue(CLEAR_CONFIG.LIMITS.MIN)
				.setMaxValue(CLEAR_CONFIG.LIMITS.MAX),
		),
);

/**
 * Subcommand 3: all - Delete all messages with confirmation
 * Requires explicit confirmation via button click within 15 seconds
 * This prevents accidental mass deletion of channel history
 * Limit parameter allows testing in large channels (fetches messages but deletes up to limit)
 */
builder.addSubcommand((subcommand) =>
	subcommand
		.setName("all")
		.setDescription("Delete ALL messages (with confirmation)")
		.addIntegerOption((option) =>
			option
				.setName("limit")
				.setDescription("Maximum messages to search (1-100, default: 100)")
				.setMinValue(CLEAR_CONFIG.LIMITS.MIN)
				.setMaxValue(CLEAR_CONFIG.LIMITS.MAX),
		),
);

/**
 * Command export following Discord.js Command interface
 * execute() is called when slash command is invoked
 * Validation, defer, and routing happen here before delegating to specific handlers
 */
export default {
	data: builder,
	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		if (!(await validatePermissions(interaction))) return;

		await interaction.deferReply({ ephemeral: true });

		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case "amount":
				await handleAmount(interaction);
				break;
			case "filter":
				await handleFilter(interaction);
				break;
			case "all":
				await handleAll(interaction);
				break;
			default:
				logError("execute", `Unknown subcommand: ${subcommand}`);
				await sendError(interaction, "Error", "Unknown subcommand.");
		}
	},
} satisfies Command;

/**
 * Type-safe TextChannel getter
 * Uses instanceof check instead of duck typing ("bulkDelete" in channel)
 * to ensure we only operate on channels that support bulk deletion (TextChannel, VoiceChannel, etc)
 * DM channels and other unsupported types are explicitly rejected
 * Returns null and sends error embed if validation fails
 */
async function getTextChannel(
	interaction: ChatInputCommandInteraction,
): Promise<TextChannel | null> {
	if (!(interaction.channel instanceof TextChannel)) {
		await sendError(
			interaction,
			"Invalid Channel",
			CLEAR_CONFIG.MESSAGES.INVALID_CHANNEL,
		);
		return null;
	}

	return interaction.channel;
}

/**
 * Handle /clear amount - Delete N recent messages
 * Discord.bulkDelete(count, filterOldest=true) deletes count messages, ignoring >14d old
 * true parameter skips messages older than 2 weeks (they can't be bulk deleted anyway)
 * Provides feedback showing channel and count for audit trail
 */
async function handleAmount(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const count = interaction.options.getInteger("count", true);
	const channel = await getTextChannel(interaction);
	if (!channel) return;

	try {
		// filterOldest=true: skip messages older than 14 days (Discord API limitation)
		const deleted = await channel.bulkDelete(count, true);

		await sendSuccess(
			interaction,
			"Messages Deleted",
			`Successfully removed **${deleted.size}** message(s).`,
			[{ label: "Channel", value: channel.toString(), inline: true }],
		);
	} catch (error) {
		logError("handleAmount", error);
		await sendError(
			interaction,
			"Deletion Failed",
			CLEAR_CONFIG.MESSAGES.DELETION_FAILED,
		);
	}
}

// 🔍 Filter and delete messages
/**
 * Handle /clear filter - Delete messages matching criteria
 * This handler is a dispatcher: parses filter type, validates required params,
 * applies correct filter function, and sends appropriate success message
 *
 * Design: Uses pre-composed filter functions from messageFilters.ts
 * Each case validates its required parameters before filtering to provide
 * clear feedback when user forgets to specify e.g. date for "date" filter
 *
 * Supports filters: user, bot, date, contains, images, links
 * Easy to extend: add case + add filter to messageFilters.ts
 */
async function handleFilter(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const type = interaction.options.getString("type", true);
	const limit =
		interaction.options.getInteger("limit") ??
		CLEAR_CONFIG.LIMITS.DISCORD_FETCH;
	const channel = await getTextChannel(interaction);
	if (!channel) return;

	try {
		const messages = await channel.messages.fetch({ limit });
		let filteredMessages: Message[] = [];
		let successTitle = "";
		let successDesc = "";

		switch (type) {
			case "user": {
				const user = interaction.options.getUser("user");
				if (!user) {
					await sendError(
						interaction,
						"Missing User",
						"Please specify a user.",
					);
					return;
				}
				filteredMessages = applyFilter(
					messages.values(),
					filters.byUser(user.id),
				);
				successTitle = "User Messages Deleted";
				successDesc = `Removed **${filteredMessages.length}** message(s) from **${user.username}**.`;
				break;
			}
			case "bot": {
				filteredMessages = applyFilter(messages.values(), filters.byBot());
				successTitle = "Bot Messages Deleted";
				successDesc = `Removed **${filteredMessages.length}** bot message(s).`;
				break;
			}
			case "date": {
				const dateStr = interaction.options.getString("date");
				if (!dateStr) {
					await sendError(
						interaction,
						"Missing Date",
						"Please specify a date (YYYY-MM-DD).",
					);
					return;
				}

				// Validate YYYY-MM-DD format before parsing
				const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
				if (!dateRegex.test(dateStr)) {
					await sendError(
						interaction,
						"Invalid Date Format",
						CLEAR_CONFIG.MESSAGES.INVALID_DATE_FORMAT,
					);
					return;
				}

				// Create UTC midnight timestamp: prevents timezone issues where
				// "2024-01-15" might be interpreted as local midnight instead of UTC
				const targetDate = new Date(`${dateStr}T00:00:00Z`);
				if (Number.isNaN(targetDate.getTime())) {
					await sendError(
						interaction,
						"Invalid Date",
						CLEAR_CONFIG.MESSAGES.INVALID_DATE,
					);
					return;
				}

				filteredMessages = applyFilter(
					messages.values(),
					filters.byDate(targetDate),
				);
				successTitle = "Messages After Date Deleted";
				successDesc = `Removed **${filteredMessages.length}** message(s) after **${dateStr}**.`;
				break;
			}
			case "contains": {
				const keyword = interaction.options.getString("keyword");
				if (!keyword) {
					await sendError(
						interaction,
						"Missing Keyword",
						"Please specify a keyword to search for.",
					);
					return;
				}

				filteredMessages = applyFilter(
					messages.values(),
					filters.byKeyword(keyword),
				);
				successTitle = "Messages Deleted";
				// Escape markdown in keyword to prevent breaking embed formatting
				// (e.g., user input like "**bold**" won't break the message)
				successDesc = `Removed **${filteredMessages.length}** message(s) containing \`${escapeMd(keyword)}\`.`;
				break;
			}
			case "images": {
				filteredMessages = applyFilter(messages.values(), filters.byImages());
				successTitle = "Image Messages Deleted";
				successDesc = `Removed **${filteredMessages.length}** message(s) with images.`;
				break;
			}
			case "links": {
				filteredMessages = applyFilter(messages.values(), filters.byLinks());
				successTitle = "Link Messages Deleted";
				successDesc = `Removed **${filteredMessages.length}** message(s) with links.`;
				break;
			}
		}

		// Early return if no matches found - prevents API call with empty array
		if (filteredMessages.length === 0) {
			await sendWarning(
				interaction,
				"No Messages Found",
				`No messages matching the **${type}** filter in the last ${limit} messages.`,
			);
			return;
		}

		// Discord's bulkDelete accepts up to 100 messages
		// Third param 'true' ignores errors for messages >14 days old (Discord API limitation)
		const deleted = await channel.bulkDelete(filteredMessages, true);

		await sendSuccess(interaction, successTitle, successDesc, [
			{ label: "Messages", value: deleted.size.toString(), inline: true },
		]);
	} catch (error) {
		logError("handleFilter", error);
		await sendError(
			interaction,
			"Deletion Failed",
			CLEAR_CONFIG.MESSAGES.DELETION_FAILED,
		);
	}
}

// 💥 Delete all messages with confirmation
/**
 * Handle /clear all - Destructive deletion requiring user confirmation
 *
 * This function implements a two-stage deletion:
 * 1. Show confirmation dialog with Confirm/Cancel buttons (15s timeout)
 * 2. On Confirm, fetch and bulk delete messages
 *
 * Safety measures:
 * - Only bot invoker can use buttons (filter by user.id)
 * - Timeout protects against hanging interactions
 * - Distinguishes timeout errors from actual failures for proper feedback
 * - Messages >14 days old silently skip (Discord API limitation)
 */
async function handleAll(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const limit =
		interaction.options.getInteger("limit") ??
		CLEAR_CONFIG.LIMITS.DISCORD_FETCH;
	const channel = await getTextChannel(interaction);
	if (!channel) return;

	const confirmButton = new ButtonBuilder()
		.setCustomId("clear_confirm")
		.setLabel("Confirm")
		.setStyle(ButtonStyle.Danger);

	const cancelButton = new ButtonBuilder()
		.setCustomId("clear_cancel")
		.setLabel("Cancel")
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		confirmButton,
		cancelButton,
	);

	const warningEmbed = createWarningEmbed(
		"⚠️ Destructive Action",
		CLEAR_CONFIG.MESSAGES.ALL_CONFIRM,
	);

	await interaction.editReply({ embeds: [warningEmbed], components: [row] });

	try {
		// Wait for button click from original command invoker only (filter)
		// Timeout after 15s to prevent hanging interactions
		const confirmation = await interaction.channel?.awaitMessageComponent({
			filter: (i) => i.user.id === interaction.user.id,
			time: 15000,
		});

		if (!confirmation) {
			await interaction.editReply({
				content: CLEAR_CONFIG.MESSAGES.TIMEOUT,
				components: [],
				embeds: [],
			});
			return;
		}

		// Handle Cancel button
		if (confirmation.customId === "clear_cancel") {
			await confirmation.update({
				content: "Operation cancelled.",
				components: [],
				embeds: [],
			});
			return;
		}

		// Handle Confirm button
		if (confirmation.customId === "clear_confirm") {
			try {
				const messages = await channel.messages.fetch({ limit });

				if (messages.size === 0) {
					await confirmation.update({
						content: "No messages to delete.",
						components: [],
						embeds: [],
					});
					return;
				}

				// bulkDelete silently skips messages >14 days old
				const deleted = await channel.bulkDelete(messages, true);

				await confirmation.update({
					components: [],
					embeds: [
						{
							title: "All Messages Deleted",
							description: `Successfully removed **${deleted.size}** message(s).`,
							color: 0x57f287,
						},
					],
				});
			} catch (error) {
				logError("handleAll - bulk delete", error);
				await confirmation.update({
					content: CLEAR_CONFIG.MESSAGES.DELETION_FAILED,
					components: [],
					embeds: [],
				});
			}
		}
	} catch (error) {
		// Distinguish timeout from other errors for appropriate user feedback
		const isTimeout =
			error instanceof Error &&
			(error.message.includes("time") || error.message.includes("Collector"));
		await interaction.editReply({
			content: isTimeout
				? CLEAR_CONFIG.MESSAGES.TIMEOUT
				: "Something went wrong.",
			components: [],
			embeds: [],
		});
		// Only log non-timeout errors (timeouts are expected)
		if (!isTimeout) {
			logError("handleAll - confirmation", error);
		}
	}
}
