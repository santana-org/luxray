/**
 * 🤖 Ready Event - Bot Startup Handler
 *
 * Fires once when bot successfully authenticates and connects to Discord.
 * This is the perfect place for startup routines:
 * - Set bot presence/status (users see this in member list)
 * - Initialize databases
 * - Fetch remote data (like GitHub org stats shown in presence)
 * - Log startup info
 *
 * Design: Separates startup logic from main index.ts for clarity
 * and enables easy addition of new startup routines.
 */

import { ActivityType, type Client, Events } from "discord.js";
import { LOGS, logger } from "@/utils/logger/index.js";

// GitHub API configuration for fetching org repo count
const GITHUB_API = {
	BASE_URL: "https://api.github.com",
	ORG_ENDPOINT: "/orgs/santana-org",
	USER_AGENT: "luxray-bot",
} as const;

// Bot presence: what users see next to bot name in member list
const PRESENCE_CONFIG = {
	STATUS: "dnd", // "online" | "idle" | "dnd" | "invisible"
	ACTIVITY_TYPE: ActivityType.Watching,
	GITHUB_URL: "https://github.com/santana-org",
} as const;

// Type for GitHub API response
interface GitHubOrg {
	public_repos: number;
}

/**
 * Fetch repo count from GitHub org
 *
 * Used to populate bot presence activity: "Watching 42 repositories"
 * Silently defaults to 0 if fetch fails (prevents bot startup from blocking)
 *
 * @returns Number of public repos (or 0 if API call fails)
 */
async function fetchRepoCount(): Promise<number> {
	try {
		const url = `${GITHUB_API.BASE_URL}${GITHUB_API.ORG_ENDPOINT}`;
		const res = await fetch(url, {
			headers: { "User-Agent": GITHUB_API.USER_AGENT },
		});

		if (!res.ok) {
			logger.error(`⚠️ GitHub API returned ${res.status} ${res.statusText}`);
			return 0;
		}

		const data = (await res.json()) as GitHubOrg;
		return data.public_repos;
	} catch (err) {
		logger.error("⚠️ Failed to fetch GitHub org info", err);
		return 0;
	}
}

export default {
	name: Events.ClientReady,
	once: true, // Fire exactly once on startup
	async execute(client: Client<true>): Promise<void> {
		const count = await fetchRepoCount();

		// Set bot presence: visible to all members in member list
		client.user.setPresence({
			status: PRESENCE_CONFIG.STATUS,
			activities: [
				{
					name: `reviewing ${count} repositories`,
					type: PRESENCE_CONFIG.ACTIVITY_TYPE,
					url: PRESENCE_CONFIG.GITHUB_URL,
				},
			],
		});

		logger.info(LOGS.BOT_READY(client.user.tag));
	},
};
