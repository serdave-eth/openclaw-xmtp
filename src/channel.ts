import type { ResolvedXmtpAccount } from "./config-types.js";
import {
  listAccountIds,
  resolveAccount,
  isAccountConfigured,
  describeAccount,
} from "./accounts.js";
import { XmtpClient, type InboundXmtpMessage } from "./lib/xmtp-client.js";
import { setClient, getClient, removeClient } from "./clients.js";
import { getXmtpRuntime } from "./runtime.js";
import { handleXmtpInbound } from "./inbound.js";
import { xmtpOnboardingAdapter } from "./onboarding.js";
import { xmtpChannelConfigSchema, uiHints } from "./config-schema.js";
import {
  buildChannelConfigSchema,
  formatPairingApproveHint,
  PAIRING_APPROVED_MESSAGE,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";

const CHANNEL_ID = "xmtp" as const;

/**
 * XMTP Channel Plugin — full ChannelPlugin<ResolvedXmtpAccount> implementation.
 *
 * Adapters: meta, capabilities, config, gateway, outbound, security, pairing.
 * Follows the pattern established by extensions/irc/src/channel.ts.
 */
export const xmtpPlugin = {
  id: CHANNEL_ID,

  meta: {
    id: CHANNEL_ID,
    label: "XMTP",
    selectionLabel: "XMTP (Encrypted Messaging)",
    aliases: ["xmtp"],
    docsPath: "/channels/xmtp",
    blurb: "End-to-end encrypted messaging via the XMTP protocol.",
  },

  capabilities: {
    chatTypes: ["direct", "group"] as const,
  },

  configSchema: buildChannelConfigSchema(xmtpChannelConfigSchema),
  uiHints,
  onboarding: xmtpOnboardingAdapter,

  // ── Config adapter ──
  // Framework passes full OpenClawConfig; we extract cfg.channels?.xmtp.
  // Same pattern as IRC (which casts cfg as CoreConfig then accesses cfg.channels?.irc).
  config: {
    listAccountIds: (cfg: any) =>
      listAccountIds(cfg.channels?.xmtp ?? {}),

    resolveAccount: (cfg: any, accountId: string) =>
      resolveAccount(cfg.channels?.xmtp ?? {}, accountId ?? "default"),

    isConfigured: (account: ResolvedXmtpAccount) =>
      isAccountConfigured(account),

    // Returns ChannelAccountSnapshot object (not string).
    // The string version in accounts.ts:describeAccount() is used for logging.
    describeAccount: (account: ResolvedXmtpAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled !== false,
      configured: isAccountConfigured(account),
      env: account.env,
      dmPolicy: account.dmPolicy,
      groupPolicy: account.groupPolicy,
    }),

    resolveAllowFrom: ({ cfg }: { cfg: any }) =>
      ((cfg as any).channels?.xmtp?.allowFrom ?? []).map(String),

    formatAllowFrom: ({ allowFrom }: { allowFrom: string[] }) =>
      allowFrom.map((e) => String(e).toLowerCase().trim()).filter(Boolean),
  },

  // ── Gateway adapter ──
  gateway: {
    async startAccount(ctx: any): Promise<void> {
      const { account, abortSignal, log, cfg, runtime } = ctx;

      if (!isAccountConfigured(account)) {
        throw new Error(
          `XMTP account "${account.accountId}" is missing walletKey or dbEncryptionKey. ` +
            `Run "openclaw configure" to set up XMTP credentials.`,
        );
      }

      log?.info(`Starting XMTP account: ${describeAccount(account)}`);

      const logger = {
        info: (msg: string) => log?.info(msg),
        warn: (msg: string) => log?.warn(msg),
        error: (msg: string) => log?.error(msg),
        debug: (msg: string) => log?.debug?.(msg),
      };

      const client = new XmtpClient({
        walletKey: account.walletKey,
        dbEncryptionKey: account.dbEncryptionKey,
        env: account.env ?? "production",
        accountId: account.accountId,
        debug: account.debug,
        logger,
        onMessage: (msg: InboundXmtpMessage) => {
          handleXmtpInbound({
            message: msg,
            account,
            config: cfg as OpenClawConfig,
            runtime,
          }).catch((err) => {
            log?.error(`XMTP inbound handler error: ${String(err)}`);
          });
        },
      });

      await client.create();
      await client.start();
      setClient(account.accountId, client);

      const address = client.getAddress();
      log?.info(
        `XMTP account "${account.accountId}" connected (address: ${address})`,
      );

      // Block until abort signal fires (keeps the channel alive)
      await new Promise<void>((resolve) => {
        if (abortSignal.aborted) {
          resolve();
          return;
        }
        abortSignal.addEventListener("abort", () => resolve(), { once: true });
      });

      // Cleanup on abort
      log?.info(`Stopping XMTP account "${account.accountId}"`);
      await client.stop();
      removeClient(account.accountId);
    },

    async stopAccount(ctx: any): Promise<void> {
      const accountId = ctx.account?.accountId ?? ctx.accountId;
      const client = getClient(accountId);
      if (client) {
        await client.stop();
        removeClient(accountId);
      }
    },
  },

  // ── Outbound adapter ──
  // sendText takes ChannelOutboundContext { cfg, to, text, accountId, ... }
  outbound: {
    deliveryMode: "direct" as const,
    chunker: (text: string, limit: number) =>
      getXmtpRuntime().channel.text.chunkText(text, limit),
    textChunkLimit: 4000,

    async sendText({
      to,
      text,
      accountId,
    }: {
      to: string;
      text: string;
      accountId?: string;
    }): Promise<{ channel: string }> {
      const client = getClient(accountId ?? "default");
      if (!client) {
        throw new Error(`XMTP client not found for account "${accountId}"`);
      }
      await client.sendToConversation(to, text);
      return { channel: CHANNEL_ID };
    },
  },

  // ── Security adapter ──
  // Required for pairing flow and `openclaw doctor`.
  security: {
    resolveDmPolicy: ({ account }: { account: ResolvedXmtpAccount }) => ({
      policy: account.dmPolicy ?? "pairing",
      allowFrom: account.allowFrom ?? [],
      policyPath: "channels.xmtp.dmPolicy",
      allowFromPath: "channels.xmtp.allowFrom",
      approveHint: formatPairingApproveHint("xmtp"),
      normalizeEntry: (raw: string) => String(raw).toLowerCase().trim(),
    }),
  },

  // ── Pairing adapter ──
  // Required for pairing approval notifications.
  pairing: {
    idLabel: "xmtpAddress",
    normalizeAllowEntry: (entry: string) => String(entry).toLowerCase().trim(),

    async notifyApproval({ id }: { id: string }): Promise<void> {
      const client = getClient("default");
      if (!client) return;
      if (id.startsWith("0x") && id.length === 42) {
        await client.sendDm(id as `0x${string}`, PAIRING_APPROVED_MESSAGE);
      }
    },
  },
};
