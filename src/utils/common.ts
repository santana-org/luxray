/**
 * Generic utility functions used across commands
 * Extracted to separate module for reusability (not clear-specific)
 */

/**
 * Async sleep helper for rate limiting and delays
 *
 * Useful for:
 * - Throttling rapid API calls to avoid rate limits (Discord API: 50req/sec per channel)
 * - Adding delays between batch operations
 * - Testing async timeouts
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 *
 * Example: await sleep(1000); // Wait 1 second
 */
export const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Escape Discord markdown characters to prevent formatting breaks
 *
 * When user input (search keywords, usernames) is displayed in embeds,
 * special markdown characters can break formatting:
 * - "**bold**" as input becomes bold in output
 * - "[link]" becomes a link reference
 * - "`code`" becomes code block
 *
 * This function escapes all markdown syntax to treat user input as literal text
 *
 * @param text - Raw user input containing potential markdown
 * @returns Text with markdown characters escaped
 *
 * Example: escapeMd("**test**") => "\\*\\*test\\*\\*"
 */
export const escapeMd = (text: string): string => {
	return text
		.replace(/\*/g, "\\*")
		.replace(/_/g, "\\_")
		.replace(/~/g, "\\~")
		.replace(/`/g, "\\`")
		.replace(/\|/g, "\\|")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)")
		.replace(/</g, "\\<")
		.replace(/>/g, "\\>");
};
