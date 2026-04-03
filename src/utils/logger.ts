import { createLogger } from "@santana-org/logger";

const logger = createLogger({
  level: "info",
  label: "Luxray",
  timestamps: true,
  dateFormat: "datetime",
  redact: ["token", "password", "secret"],
})

export { logger }
