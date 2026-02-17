import type {
  XmtpChannelConfig,
  XmtpAccountConfig,
  ResolvedXmtpAccount,
} from "./config-types.js";

/**
 * List all configured account IDs.
 * Single-account mode returns ["default"].
 * Multi-account mode returns the keys of the accounts object.
 */
export function listAccountIds(config: XmtpChannelConfig): string[] {
  if (config.accounts && Object.keys(config.accounts).length > 0) {
    return Object.keys(config.accounts);
  }
  // Single-account mode: only return "default" if walletKey is present
  if (config.walletKey) {
    return ["default"];
  }
  return [];
}

/**
 * Resolve a specific account config by merging top-level defaults
 * with per-account overrides.
 */
export function resolveAccount(
  config: XmtpChannelConfig,
  accountId: string,
): ResolvedXmtpAccount {
  const topLevel = extractAccountFields(config);

  let accountOverrides: XmtpAccountConfig = {};
  if (accountId !== "default" && config.accounts?.[accountId]) {
    accountOverrides = config.accounts[accountId];
  } else if (accountId === "default" && config.accounts?.["default"]) {
    accountOverrides = config.accounts["default"];
  }

  const merged = { ...topLevel, ...accountOverrides };

  return {
    accountId,
    walletKey: merged.walletKey ?? "",
    dbEncryptionKey: merged.dbEncryptionKey ?? "",
    name: merged.name,
    enabled: merged.enabled,
    env: merged.env,
    debug: merged.debug,
    dmPolicy: merged.dmPolicy,
    allowFrom: merged.allowFrom,
    groupPolicy: merged.groupPolicy,
    groupAllowFrom: merged.groupAllowFrom,
    groups: merged.groups,
    historyLimit: merged.historyLimit,
    textChunkLimit: merged.textChunkLimit,
    chunkMode: merged.chunkMode,
    reactionLevel: merged.reactionLevel,
  };
}

/**
 * Check if an account has the minimum required configuration.
 */
export function isAccountConfigured(account: ResolvedXmtpAccount): boolean {
  return (
    typeof account.walletKey === "string" &&
    account.walletKey.length > 0 &&
    typeof account.dbEncryptionKey === "string" &&
    account.dbEncryptionKey.length > 0
  );
}

/**
 * Return a human-readable description of an account for logs.
 */
export function describeAccount(account: ResolvedXmtpAccount): string {
  const parts = [`account=${account.accountId}`];
  if (account.name) parts.push(`name="${account.name}"`);
  if (account.env) parts.push(`env=${account.env}`);
  if (account.dmPolicy) parts.push(`dm=${account.dmPolicy}`);
  if (account.groupPolicy) parts.push(`group=${account.groupPolicy}`);
  return parts.join(", ");
}

/**
 * Extract account-level fields from the top-level config (strip `accounts`).
 */
function extractAccountFields(
  config: XmtpChannelConfig,
): XmtpAccountConfig {
  const { accounts: _, ...rest } = config;
  return rest;
}
