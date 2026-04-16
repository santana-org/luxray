/**
 * Mute System - Prisma-based Persistent Storage
 *
 * Manages temporary member muting with:
 * - SQLite persistence via Prisma ORM
 * - Hybrid expiration strategy (timers for short mutes, polling for long ones)
 * - Automatic cleanup on bot startup
 * - Graceful DM notifications
 */

import type { Client } from "discord.js";
import { prisma } from "@/utils/database/index.js";
import { logger } from "@/utils/logger/index.js";

const SHORT_MUTE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
// const MAX_DURATION_MS = 28 * 24 * 60 * 60 * 1000; // 28 days max - used in parseDuration

// Map to track active timers for short mutes
const muteTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Reference to polling interval so it can be cleared on shutdown
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize mute system from database
 * Reconstructs all active timers from persisted mutes
 */
export async function initializeMuteSystem(client: Client): Promise<void> {
	try {
		const activeMutes = await prisma.mute.findMany();
		logger.info(
			`[Mutes] Loading ${activeMutes.length} active mutes from database`,
		);

		for (const mute of activeMutes) {
			const remaining = Number(mute.muteEndTime) - Date.now();
			if (remaining > 0) {
				scheduleMuteExpiration(mute.guildId, mute.userId, remaining, client);
			} else {
				// Expired while bot was offline, clean up immediately
				await expireMute(mute.guildId, mute.userId, client);
			}
		}

		// Start polling for long mutes (> 24h) that don't use setTimeout
		if (pollingTimer) {
			clearInterval(pollingTimer);
		}
		pollingTimer = setInterval(async () => {
			try {
				await checkAndExpireOldMutes(client);
			} catch (error) {
				logger.error("[Mutes] Polling error during expiration check", error);
			}
		}, POLLING_INTERVAL);

		logger.info("[Mutes] Mute system initialized successfully");
	} catch (error) {
		logger.error("[Mutes] Failed to initialize mute system", error);
		throw error;
	}
}

/**
 * Schedule mute expiration with hybrid strategy
 * - Short mutes: Individual setTimeout for exact expiration
 * - Long mutes: Rely on polling interval started in initializeMuteSystem
 */
function scheduleMuteExpiration(
	guildId: string,
	userId: string,
	durationMs: number,
	client: Client,
): void {
	const key = `${guildId}:${userId}`;

	// Clear existing timer if any
	if (muteTimers.has(key)) {
		const timer = muteTimers.get(key);
		if (timer) clearTimeout(timer);
	}

	// Use timer for short mutes (< 24h) for exact expiration
	if (durationMs <= SHORT_MUTE_THRESHOLD) {
		const timer = setTimeout(async () => {
			try {
				await expireMute(guildId, userId, client);
			} catch (error) {
				logger.error(
					`[Mutes] Failed to expire mute ${guildId}:${userId}`,
					error,
				);
			}
		}, durationMs);

		muteTimers.set(key, timer);
	}
	// Long mutes are handled by the polling interval in initializeMuteSystem
}

/**
 * Add a new mute to the system
 */
export async function addMute(
	guildId: string,
	userId: string,
	moderatorId: string,
	durationMs: number,
	reason: string | null,
	client: Client,
	muteRoleId: string,
): Promise<void> {
	const muteEndTime = Date.now() + durationMs;

	try {
		await prisma.mute.upsert({
			where: {
				guildId_userId: {
					guildId,
					userId,
				},
			},
			update: {
				muteEndTime: BigInt(muteEndTime),
				reason,
				muteRoleId,
				mutedBy: moderatorId,
				updatedAt: new Date(),
			},
			create: {
				guildId,
				userId,
				muteStartTime: BigInt(Date.now()),
				muteEndTime: BigInt(muteEndTime),
				reason,
				muteRoleId,
				mutedBy: moderatorId,
			},
		});

		// Schedule expiration
		scheduleMuteExpiration(guildId, userId, durationMs, client);

		logger.info(
			`[Mutes] Added mute for ${userId} in guild ${guildId} (${formatTimeRemaining(durationMs)})`,
		);
	} catch (error) {
		logger.error(`[Mutes] Failed to add mute for ${userId}`, error);
		throw error;
	}
}

/**
 * Remove a mute from the system
 */
export async function removeMute(
	guildId: string,
	userId: string,
): Promise<void> {
	try {
		const key = `${guildId}:${userId}`;
		const timer = muteTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			muteTimers.delete(key);
		}

		await prisma.mute.delete({
			where: {
				guildId_userId: {
					guildId,
					userId,
				},
			},
		});

		logger.info(`[Mutes] Removed mute for ${userId} in guild ${guildId}`);
	} catch (error) {
		// P2025 = "An operation failed because it depends on one or more records that were required but not found"
		// This is fine - the mute might have already been deleted or never existed
		const isP2025 =
			(error instanceof Error && error.message.includes("P2025")) ||
			(error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "P2025");

		if (isP2025) {
			// Record doesn't exist, silently ignore
			return;
		}
		logger.warn(`[Mutes] Error removing mute for ${userId}:`, error);
	}
}

/**
 * Get all active mutes for a guild
 */
export async function getMutedUsers(guildId: string): Promise<
	Array<{
		userId: string;
		muteStartTime: number;
		muteEndTime: number;
		reason: string | null;
		mutedBy: string;
	}>
> {
	try {
		const mutes = await prisma.mute.findMany({
			where: { guildId },
		});

		return mutes.map((m: any) => ({
			userId: m.userId,
			muteStartTime: Number(m.muteStartTime),
			muteEndTime: Number(m.muteEndTime),
			reason: m.reason,
			mutedBy: m.mutedBy,
		}));
	} catch (error) {
		logger.error(
			`[Mutes] Failed to get muted users for guild ${guildId}`,
			error,
		);
		return [];
	}
}

/**
 * Check and expire mutes that should no longer be active
 * Called by polling interval for long mutes (> 24h)
 */
export async function checkAndExpireOldMutes(client: Client): Promise<void> {
	try {
		const now = BigInt(Date.now());
		const expiredMutes = await prisma.mute.findMany({
			where: {
				muteEndTime: {
					lt: now,
				},
			},
		});

		for (const mute of expiredMutes) {
			try {
				await expireMute(mute.guildId, mute.userId, client);
			} catch (error) {
				logger.error(
					`[Mutes] Failed to expire mute ${mute.guildId}:${mute.userId}`,
					error,
				);
			}
		}

		if (expiredMutes.length > 0) {
			logger.info(`[Mutes] Expired ${expiredMutes.length} mutes`);
		}
	} catch (error) {
		logger.error("[Mutes] Failed to check expired mutes", error);
	}
}

/**
 * Expire a specific mute (remove role and clear tracking)
 */
async function expireMute(
	guildId: string,
	userId: string,
	client: Client,
): Promise<void> {
	const key = `${guildId}:${userId}`;

	try {
		// Fetch mute record first - we need the muteRoleId
		const mute = await prisma.mute.findUnique({
			where: {
				guildId_userId: {
					guildId,
					userId,
				},
			},
		});

		if (!mute) {
			// Mute record doesn't exist, clean up timer and return
			const timer = muteTimers.get(key);
			if (timer) {
				clearTimeout(timer);
				muteTimers.delete(key);
			}
			return;
		}

		// Try to remove the role from the member
		try {
			const guild = await client.guilds.fetch(guildId);

			// Force fresh fetch of member to bypass stale role cache
			const member = await guild.members
				.fetch({ user: userId, force: true })
				.catch(() => null);

			if (member) {
				// Force fresh fetch of role to bypass stale role cache
				const muteRole = await guild.roles
					.fetch(mute.muteRoleId, { force: true })
					.catch(() => null);

				if (muteRole) {
					// member.roles.cache is now accurate because we used force:true above
					if (member.roles.cache.has(mute.muteRoleId)) {
						await member.roles
							.remove(muteRole, "Mute expired")
							.catch((error) => {
								logger.warn(
									`[Mutes] Failed to remove mute role from ${userId}:`,
									error,
								);
							});
						logger.info(
							`[Mutes] Removed mute role from ${userId} in guild ${guildId}`,
						);
					} else {
						logger.info(
							`[Mutes] Member ${userId} no longer has mute role, skipping removal`,
						);
					}
				} else {
					logger.warn(
						`[Mutes] Mute role ${mute.muteRoleId} not found in guild ${guildId}`,
					);
				}
			} else {
				logger.info(
					`[Mutes] Member ${userId} not in guild ${guildId} (may have left), cleaning up DB`,
				);
			}
		} catch (error) {
			// Log role removal failures but don't stop - we still need to clean up the DB
			logger.warn(`[Mutes] Error during role removal for ${userId}:`, error);
		}

		// Clear timer
		const timer = muteTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			muteTimers.delete(key);
		}

		// Remove from database
		await removeMute(guildId, userId);
	} catch (error) {
		logger.error(`[Mutes] Failed to expire mute ${guildId}:${userId}:`, error);
	}
}

/**
 * Format time remaining (ms -> human readable)
 */
export function formatTimeRemaining(ms: number): string {
	const days = Math.floor(ms / (24 * 60 * 60 * 1000));
	const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
	const seconds = Math.floor((ms % (60 * 1000)) / 1000);

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(" ") || "0s";
}

/**
 * Parse duration string to milliseconds
 * Supports formats: "1h", "30m", "2d", "1h30m", "1d2h30m15s"
 */
export function parseDuration(input: string): number | null {
	const MAX_DURATION_MS_LOCAL = 28 * 24 * 60 * 60 * 1000; // 28 days max
	const regex = /(\d+)\s*([dhms])/gi;
	let totalMs = 0;

	let match = regex.exec(input);
	while (match !== null) {
		const amount = parseInt(match[1], 10);
		const unit = match[2].toLowerCase();

		switch (unit) {
			case "d":
				totalMs += amount * 24 * 60 * 60 * 1000;
				break;
			case "h":
				totalMs += amount * 60 * 60 * 1000;
				break;
			case "m":
				totalMs += amount * 60 * 1000;
				break;
			case "s":
				totalMs += amount * 1000;
				break;
		}

		match = regex.exec(input);
	}

	// Validate: must be positive and not exceed max
	if (totalMs <= 0 || totalMs > MAX_DURATION_MS_LOCAL) return null;

	return totalMs;
}

/**
 * Convert Unix timestamp (ms) to Discord timestamp format
 * Format: <t:1234567890:f> renders as localized time for each user
 * Format options: t (short time), T (long time), d (short date), D (long date), f (short date+time), F (long date+time), R (relative)
 */
export function discordTimestamp(ms: number, format: string = "f"): string {
	return `<t:${Math.floor(ms / 1000)}:${format}>`;
}

// Alias for backwards compatibility
export const toDiscordTimestamp = discordTimestamp;

/**
 * Get polling interval for mute expiration checks
 */
export function getPollingInterval(): number {
	return POLLING_INTERVAL;
}

/**
 * Cleanup on shutdown
 */
export async function cleanupMuteSystem(): Promise<void> {
	if (pollingTimer) {
		clearInterval(pollingTimer);
		pollingTimer = null;
	}

	for (const timer of muteTimers.values()) {
		clearTimeout(timer);
	}
	muteTimers.clear();
	logger.info("[Mutes] Mute system cleaned up");
}
