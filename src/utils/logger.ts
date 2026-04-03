const timestamp = () => new Date().toISOString();

export const logger = {
  info(message: string): void {
    console.log(`[${timestamp()}] [INFO] ${message}`);
  },
  error(message: string, error?: unknown): void {
    console.error(`[${timestamp()}] [ERROR] ${message}`, error ?? '');
  },
};
