import { type Client, Events, ActivityType } from 'discord.js';
import { logger, LOGS } from '../utils/logger.js';

interface GitHubOrg {
  public_repos: number;
}

async function fetchRepoCount(): Promise<number> {
  try {
    const res = await fetch('https://api.github.com/orgs/santana-org', {
      headers: { 'User-Agent': 'luxray-bot' },
    });
    if (!res.ok) {
      logger.error(`GitHub API returned ${res.status} ${res.statusText}`);
      return 0;
    }
    const data = (await res.json()) as GitHubOrg;
    return data.public_repos;
  } catch (err) {
    logger.error('Failed to fetch GitHub org info', err);
    return 0;
  }
}

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client<true>): Promise<void> {
    const count = await fetchRepoCount();

    client.user.setPresence({
      status: 'dnd',
      activities: [
        {
          name: `reviewing ${count} repositories`,
          type: ActivityType.Watching,
        },
      ],
    });

    logger.info(LOGS.BOT_READY(client.user.tag));
  },
};
