import { z } from "zod";

const dmPolicySchema = z.enum(["pairing", "allowlist", "open", "disabled"]);
const groupPolicySchema = z.enum(["open", "disabled", "allowlist"]);
const envSchema = z.enum(["production", "dev", "local"]);
const reactionLevelSchema = z.enum(["off", "ack", "minimal", "extensive"]);
const chunkModeSchema = z.enum(["length", "newline"]);

/**
 * Zod schema for a single XMTP account config.
 */
export const xmtpAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  walletKey: z.string().optional(),
  dbEncryptionKey: z.string().optional(),
  env: envSchema.optional(),
  debug: z.boolean().optional(),
  dmPolicy: dmPolicySchema.optional(),
  allowFrom: z.array(z.string()).optional(),
  groupPolicy: groupPolicySchema.optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  historyLimit: z.number().int().positive().optional(),
  textChunkLimit: z.number().int().positive().optional(),
  chunkMode: chunkModeSchema.optional(),
  reactionLevel: reactionLevelSchema.optional(),
});

/**
 * Zod schema for the full XMTP channel config (top-level + accounts).
 */
export const xmtpChannelConfigSchema = xmtpAccountSchema.extend({
  accounts: z.record(z.string(), xmtpAccountSchema).optional(),
});

/**
 * UI hints for the Control UI form generation.
 * Fields marked sensitive will be masked in the UI.
 */
export const uiHints = {
  walletKey: {
    sensitive: true,
    label: "Wallet Private Key",
    description: "Hex private key for the XMTP identity. Supports env var references: ${XMTP_WALLET_KEY}",
    placeholder: "0x... or ${XMTP_WALLET_KEY}",
  },
  dbEncryptionKey: {
    sensitive: true,
    label: "DB Encryption Key",
    description: "64-char hex key for local DB encryption. Supports env var references: ${XMTP_DB_ENCRYPTION_KEY}",
    placeholder: "0x... or ${XMTP_DB_ENCRYPTION_KEY}",
  },
  env: {
    label: "XMTP Environment",
    description: "Network environment to connect to",
    options: ["production", "dev", "local"],
    default: "production",
  },
  dmPolicy: {
    label: "DM Policy",
    description: "How to handle incoming direct messages from unknown senders",
    options: ["pairing", "allowlist", "open", "disabled"],
    default: "pairing",
  },
  groupPolicy: {
    label: "Group Policy",
    description: "How to handle group conversation messages",
    options: ["open", "disabled", "allowlist"],
    default: "open",
  },
};

export type XmtpChannelConfigInput = z.input<typeof xmtpChannelConfigSchema>;
export type XmtpChannelConfigOutput = z.output<typeof xmtpChannelConfigSchema>;
