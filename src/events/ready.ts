import { ActivityType, type Client, Events } from "discord.js";
import { LOGS, logger } from "../utils/logger.js";

// 🔗 API configuration constants
const GITHUB_API = {
	BASE_URL: "https://api.github.com",
	ORG_ENDPOINT: "/orgs/santana-org",
	USER_AGENT: "luxray-bot",
} as const;

// 🎮 Bot presence configuration
const PRESENCE_CONFIG = {
	STATUS: "dnd",
	ACTIVITY_TYPE: ActivityType.Watching,
	GITHUB_URL: "https://github.com/santana-org",
} as const;

// 📊 Response structure
interface GitHubOrg {
	public_repos: number;
}

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
	once: true,
	async execute(client: Client<true>): Promise<void> {
		const count = await fetchRepoCount();

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
