/**
 * Message filtering utilities for reusable filtering logic
 *
 * Design: Curried functions that return filter predicates
 * This allows composition: applyFilter(messages, filters.byUser(userId))
 *
 * Adding new filters:
 * 1. Add function to filters object
 * 2. Add case to clear.ts handleFilter() switch
 * 3. Add SchemaSubcommandOption to command definition
 * That's it - no other changes needed
 */

import type { Message } from "discord.js";
import { logger } from "./logger.js";

/**
 * Filter factory object: each method returns a predicate function
 *
 * Currying pattern enables composition and makes filters testable
 * Example: const filter = filters.byUser("123"); filter(message) => boolean
 */
export const filters = {
	/**
	 * Filter messages by specific user
	 * Useful for cleaning up spam from problematic users
	 */
	byUser:
		(userId: string) =>
		(msg: Message): boolean =>
			msg.author.id === userId,

	/**
	 * Filter bot-authored messages
	 * Common need: clean up logs/notifications from other bots
	 */
	byBot:
		(): ((msg: Message) => boolean) =>
		(msg: Message): boolean =>
			msg.author.bot,

	/**
	 * Filter messages created at or after a date
	 * Uses message.createdAt which is server timestamp, same timezone as Discord
	 * Date comparison works because Discord timestamps are ISO strings
	 */
	byDate:
		(targetDate: Date) =>
		(msg: Message): boolean =>
			msg.createdAt >= targetDate,

	/**
	 * Case-insensitive substring search
	 * Matches anywhere in message content (partial matches ok)
	 */
	byKeyword:
		(keyword: string) =>
		(msg: Message): boolean =>
			msg.content.toLowerCase().includes(keyword.toLowerCase()),

	/**
	 * Filter messages with image attachments
	 * Checks both contentType (MIME type) and filename extensions
	 * Fallback to extension check because some attachments lack contentType
	 */
	byImages:
		(): ((msg: Message) => boolean) =>
		(msg: Message): boolean =>
			msg.attachments.some(
				(att) =>
					att.contentType?.startsWith("image/") ||
					att.name?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i),
			),

	/**
	 * Filter messages with HTTP/HTTPS links
	 * Regex matches full URLs; note: running test() twice on same regex
	 * resets .lastIndex (issue with global flag) - convert to array first if needed
	 */
	byLinks:
		(): ((msg: Message) => boolean) =>
		(msg: Message): boolean => {
			const urlRegex = /(https?:\/\/[^\s]+)/gi;
			return urlRegex.test(msg.content);
		},
};

/**
 * Apply filter predicate to message collection
 *
 * Converts Discord.js MessageManager.values() iterator to array,
 * filters it, and returns result ready for bulkDelete()
 *
 * @param messages - Iterator from channel.messages.fetch()
 * @param filter - Predicate function from filters object
 * @returns Filtered array of messages for bulkDelete (max 100 recommended)
 */
export const applyFilter = (
	messages: IterableIterator<Message>,
	filter: (msg: Message) => boolean,
): Message[] => {
	return Array.from(messages).filter(filter);
};

/**
 * Log error with context for debugging
 *
 * Centralizes error logging to ensure consistent formatting
 * Distinguishes Error objects from plain strings/unknown types
 *
 * @param context - Where error occurred (e.g., "handleAll - bulk delete")
 * @param error - Error object or unknown value
 */
export const logError = (context: string, error: unknown): void => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	logger.error(`[${context}] Error:`, errorMessage, error);
};
