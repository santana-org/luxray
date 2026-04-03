import { createLogger } from "@santana-org/logger";

export const logger = createLogger({
  level: "info",
  label: "Luxray",
  timestamps: true,
  dateFormat: "datetime",
  redact: ["token", "password", "secret"],
})

export const LOGS = {
  BOT_READY: (tag: string) => `🤖 Ready — logged in as ${tag}`,
  EVENTS_LOADED: (count: number) => `📡 Events loaded: ${count}`,
  COMMANDS_LOADED: (count: number) => `🔧 Commands loaded: ${count}`,
  COMMANDS_REGISTERED: (count: number, scope: string) =>
    `✅ Slash commands registered: ${count} (${scope})`,
  BOOT_FAILED: '❌ Failed to start bot',
  UNKNOWN_COMMAND: (name: string) => `❓ Unknown slash command: ${name}`,
  COMMAND_ERROR: (name: string) => `❌ Error in slash command: ${name}`,
  UNKNOWN_PREFIX_CMD: (name: string) => `❓ Unknown prefix command: ${name}`,
  PREFIX_CMD_ERROR: (name: string) => `❌ Error in prefix command: ${name}`,
};

