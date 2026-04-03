import { fileURLToPath } from 'node:url';

/**
 * Returns the file extension of the currently executing module.
 * Returns '.ts' when running via tsx (dev), '.js' when running compiled output.
 */
export function getSourceExt(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl).endsWith('.ts') ? '.ts' : '.js';
}
