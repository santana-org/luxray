/**
 * Mute Management System with SQLite Persistence & Hybrid Expiration
 *
 * Handles storing, retrieving, and managing mute records with persistent storage.
 * Mutes survive bot restarts and are stored in a local SQLite database.
 *
 * Expiration strategy (hybrid):
 * - Mutes < 24h: Individual setTimeout timers for exact expiration (zero polling)
 * - Mutes >= 24h: Periodic polling every 5 minutes as safety net
 * - On startup: Reconstruct timers from database for all active mutes
 *
 * Database schema:
 * - guildId: Discord server ID
 * - userId: Muted user ID
 * - muteEndTime: Unix timestamp (ms) when mute expires
 * - mutedBy: ID of user who applied the mute
 * - reason: Optional reason string
 * - muteStartTime: Unix timestamp (ms) when mute was applied
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { Client } from "discord.js";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "..", "db", "mutes.db");

// Initialize database connection
let db: Database.Database;

// Timer storage for short-duration mutes (< 24h)
// Key: "guildId:userId", Value: setTimeout handle
const muteTimers = new Map<string, NodeJS.Timeout>();

// Threshold: mutes shorter than this use individual timers, longer ones use polling
const SHORT_MUTE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

export function initializeMuteDatabase(): void {
	try {
		db = new Database(dbPath);
		db.pragma("journal_mode = WAL");

		// Create mutes table if it doesn't exist
		db.exec(`
			CREATE TABLE IF NOT EXISTS mutes (
				guildId TEXT NOT NULL,
				userId TEXT NOT NULL,
				muteEndTime INTEGER NOT NULL,
				mutedBy TEXT NOT NULL,
				reason TEXT,
				muteStartTime INTEGER NOT NULL,
				PRIMARY KEY (guildId, userId)
			);

			CREATE INDEX IF NOT EXISTS idx_guildId ON mutes(guildId);
			CREATE INDEX IF NOT EXISTS idx_muteEndTime ON mutes(muteEndTime);
		`);

		logger.info("✅ Mute database initialized");
	} catch (error) {
		logger.error("Failed to initialize mute database", error);
		throw error;
	}
}

interface MuteRecord {
	muteEndTime: number;
	mutedBy: string;
	reason: string | null;
	muteStartTime: number;
}

/**
 * Add or update a mute record (persisted to database)
 * Schedules expiration timer for short mutes (< 24h)
 */
export function addMute(
	guildId: string,
	userId: string,
	mutedBy: string,
	durationMs: number,
	reason: string | null = null,
	client?: Client,
): void {
	if (!db) throw new Error("Mute database not initialized");

	const muteStartTime = Date.now();
	const muteEndTime = muteStartTime + durationMs;

	const stmt = db.prepare(`
		INSERT OR REPLACE INTO mutes
		(guildId, userId, muteEndTime, mutedBy, reason, muteStartTime)
		VALUES (?, ?, ?, ?, ?, ?)
	`);

	stmt.run(guildId, userId, muteEndTime, mutedBy, reason, muteStartTime);

	// Schedule expiration timer if duration is short enough (< 24h)
	if (durationMs <= SHORT_MUTE_THRESHOLD && client) {
		scheduleMuteExpiration(guildId, userId, durationMs, client);
	}
}

/**
 * Schedule individual timer for mute expiration
 * Used only for mutes < 24h to avoid Node.js setTimeout limits
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
		const existingTimer = muteTimers.get(key);
		if (existingTimer) clearTimeout(existingTimer);
	}

	// Schedule new timer to trigger at exact expiration time
	const timer = setTimeout(async () => {
		try {
			// Remove mute role from member
			const guild = client.guilds.cache.get(guildId);
			if (guild) {
				const member = await guild.members.fetch(userId).catch(() => null);

				if (member) {
					const muteRoleId = process.env.MUTE_ROLE_ID;
					if (muteRoleId) {
						const muteRole = guild.roles.cache.get(muteRoleId);
						if (muteRole && member.roles.cache.has(muteRoleId)) {
							await member.roles.remove(muteRole, "Mute expired");
						}
					}
				}
			}

			// Remove from database
			removeMute(guildId, userId);
			muteTimers.delete(key);
			logger.debug(`Mute expired for user ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Error expiring mute for user ${userId} in guild ${guildId}`,
				error,
			);
		}
	}, durationMs);

	muteTimers.set(key, timer);
}

/**
 * Reconstruct mute timers from database on bot startup
 * Called after bot is ready to rebuild timers for all active mutes
 */
export function reconstructMuteTimersFromDatabase(client: Client): void {
	if (!db) throw new Error("Mute database not initialized");

	const now = Date.now();
	const stmt = db.prepare(
		"SELECT guildId, userId, muteEndTime FROM mutes WHERE muteEndTime > ?",
	);

	const activeMutes = stmt.all(now) as Array<{
		guildId: string;
		userId: string;
		muteEndTime: number;
	}>;

	let timerCount = 0;
	for (const mute of activeMutes) {
		const timeRemaining = mute.muteEndTime - now;

		// Only create timers for short mutes
		if (timeRemaining <= SHORT_MUTE_THRESHOLD) {
			scheduleMuteExpiration(mute.guildId, mute.userId, timeRemaining, client);
			timerCount++;
		}
	}

	if (timerCount > 0) {
		logger.info(`📋 Reconstructed ${timerCount} mute timers from database`);
	}
}

/**
 * Remove a mute record (persisted)
 */
export function removeMute(guildId: string, userId: string): boolean {
	if (!db) throw new Error("Mute database not initialized");

	// Clear any pending timer
	const key = `${guildId}:${userId}`;
	if (muteTimers.has(key)) {
		const timer = muteTimers.get(key);
		if (timer) clearTimeout(timer);
		muteTimers.delete(key);
	}

	const stmt = db.prepare("DELETE FROM mutes WHERE guildId = ? AND userId = ?");
	const result = stmt.run(guildId, userId);

	return result.changes > 0;
}

/**
 * Get mute record for a user
 * Returns null if not muted or mute is expired
 */
export function getMute(guildId: string, userId: string): MuteRecord | null {
	if (!db) throw new Error("Mute database not initialized");

	const now = Date.now();
	const stmt = db.prepare(
		"SELECT muteEndTime, mutedBy, reason, muteStartTime FROM mutes WHERE guildId = ? AND userId = ? AND muteEndTime > ?",
	);

	const result = stmt.get(guildId, userId, now) as
		| (MuteRecord & {
				muteEndTime: number;
				mutedBy: string;
				muteStartTime: number;
		  })
		| undefined;

	return result ?? null;
}

/**
 * Check if user is currently muted
 */
export function isMuted(guildId: string, userId: string): boolean {
	return getMute(guildId, userId) !== null;
}

/**
 * Get all muted users in a guild (only non-expired)
 */
export function getMutedUsers(guildId: string): Array<{
	userId: string;
	record: MuteRecord;
	timeRemaining: number;
}> {
	if (!db) throw new Error("Mute database not initialized");

	const now = Date.now();
	const stmt = db.prepare(
		"SELECT userId, muteEndTime, mutedBy, reason, muteStartTime FROM mutes WHERE guildId = ? AND muteEndTime > ? ORDER BY muteEndTime ASC",
	);

	const results = stmt.all(guildId, now) as Array<{
		userId: string;
		muteEndTime: number;
		mutedBy: string;
		reason: string | null;
		muteStartTime: number;
	}>;

	return results.map((row) => ({
		userId: row.userId,
		record: {
			muteEndTime: row.muteEndTime,
			mutedBy: row.mutedBy,
			reason: row.reason,
			muteStartTime: row.muteStartTime,
		},
		timeRemaining: row.muteEndTime - now,
	}));
}

/**
 * Clean up all expired mutes from database
 * Returns count of mutes removed
 */
export function cleanupExpiredMutes(): number {
	if (!db) throw new Error("Mute database not initialized");

	const now = Date.now();
	const stmt = db.prepare("DELETE FROM mutes WHERE muteEndTime <= ?");
	const result = stmt.run(now);

	return result.changes;
}

/**
 * Format milliseconds to readable time string
 * e.g., 3661000 -> "1h 1m 1s"
 */
export function formatTimeRemaining(ms: number): string {
	if (ms <= 0) return "Expired";

	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(" ");
}

/**
 * Parse duration string to milliseconds
 * Accepts formats like: "1h", "30m", "1h30m", "2d", etc.
 * Maximum duration: 28 days
 */
export function parseDuration(input: string): number | null {
	const MAX_DURATION_MS = 28 * 24 * 60 * 60 * 1000; // 28 days max
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
	if (totalMs <= 0 || totalMs > MAX_DURATION_MS) return null;

	return totalMs;
}

/**
 * Convert Unix timestamp (ms) to Discord timestamp format
 * Discord renders this in the user's local timezone
 * Format: <t:1234567890:f> = "November 4, 2009 7:14 PM"
 */
export function toDiscordTimestamp(
	ms: number,
	format: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "f",
): string {
	const seconds = Math.floor(ms / 1000);
	return `<t:${seconds}:${format}>`;
}
