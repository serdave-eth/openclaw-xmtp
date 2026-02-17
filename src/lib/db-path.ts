import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Resolve the DB path for an XMTP account.
 * Format: <stateDir>/xmtp/<env>/<accountId>/xmtp.db
 */
export function resolveDbPath(
  stateDir: string | undefined,
  env: string,
  accountId: string,
): string {
  const base = stateDir || path.join(os.homedir(), ".openclaw");
  return path.join(base, "xmtp", env, accountId, "xmtp.db");
}

/**
 * Ensure the parent directory for the DB path exists and is writable.
 */
export function ensureDbPathWritable(dbPath: string): void {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  // Verify we can write to the directory
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error(
      `XMTP DB directory is not writable: ${dir}. Check permissions.`,
    );
  }
}
