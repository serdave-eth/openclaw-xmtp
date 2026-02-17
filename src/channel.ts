import type { ResolvedXmtpAccount, XmtpChannelConfig } from "./config-types.js";
import {
  listAccountIds,
  resolveAccount,
  isAccountConfigured,
  describeAccount,
} from "./accounts.js";
import { XmtpClient, type InboundXmtpMessage } from "./lib/xmtp-client.js";
import { setClient, getClient, removeClient } from "./clients.js";
import { getRuntime } from "./runtime.js";

/**
 * XMTP Channel Plugin definition.
 *
 * Follows the OpenClaw ChannelPlugin adapter pattern with:
 * - meta: channel identification
 * - capabilities: supported chat types
 * - config: account resolution
 * - gateway: start/stop account lifecycle
 * - outbound: message delivery
 */
export const xmtpChannel = {
  id: "xmtp" as const,

  meta: {
    id: "xmtp" as const,
    label: "XMTP",
    selectionLabel: "XMTP (Encrypted Messaging)",
    aliases: ["xmtp"],
    docsPath: "/channels/xmtp",
    blurb: "End-to-end encrypted messaging via the XMTP protocol.",
  },

  capabilities: {
    chatTypes: ["direct", "group"] as const,
  },

  config: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listAccountIds(cfg: any): string[] {
      return listAccountIds(cfg.channels?.xmtp ?? {});
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveAccount(cfg: any, accountId: string): ResolvedXmtpAccount {
      return resolveAccount(cfg.channels?.xmtp ?? {}, accountId);
    },

    isAccountConfigured(account: ResolvedXmtpAccount): boolean {
      return isAccountConfigured(account);
    },

    describeAccount(account: ResolvedXmtpAccount): string {
      return describeAccount(account);
    },
  },

  gateway: {
    /**
     * Start an XMTP account: create client, start streaming, register in shared registry.
     * Blocks on abort signal to keep the channel alive.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async startAccount(ctx: any): Promise<void> {
      const { account, abortSignal, log } = ctx;

      if (!isAccountConfigured(account)) {
        throw new Error(
          `XMTP account "${account.accountId}" is missing walletKey or dbEncryptionKey. ` +
            `Run "openclaw configure" to set up XMTP credentials.`,
        );
      }

      log?.info(`Starting XMTP account: ${describeAccount(account)}`);

      // Try to get dispatch from the plugin runtime
      let dispatch: ((envelope: unknown) => void) | undefined;
      try {
        const runtime = getRuntime();
        dispatch = runtime.dispatch?.bind(runtime);
      } catch {
        // runtime not available — will log inbound messages instead
      }

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
          handleInboundMessage(msg, account, dispatch, logger);
        },
      });

      await client.create();
      await client.start();

      setClient(account.accountId, client);

      const address = client.getAddress();
      log?.info(`XMTP account "${account.accountId}" connected (address: ${address})`);

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

    /**
     * Stop an XMTP account.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async stopAccount(ctx: any): Promise<void> {
      const accountId = typeof ctx === "string" ? ctx : ctx.accountId;
      const client = getClient(accountId);
      if (client) {
        await client.stop();
        removeClient(accountId);
      }
    },
  },

  outbound: {
    deliveryMode: "direct" as const,
    textChunkLimit: 4000,

    /**
     * Send text to a conversation.
     */
    async sendText(
      accountId: string,
      conversationId: string,
      text: string,
    ): Promise<void> {
      const client = getClient(accountId);
      if (!client) {
        throw new Error(`XMTP client not found for account "${accountId}"`);
      }

      // Chunk text if needed
      const chunks = chunkText(text, 4000);
      for (const chunk of chunks) {
        await client.sendToConversation(conversationId, chunk);
      }
    },

    /**
     * Send a DM to a wallet address.
     */
    async sendDm(
      accountId: string,
      address: `0x${string}`,
      text: string,
    ): Promise<string> {
      const client = getClient(accountId);
      if (!client) {
        throw new Error(`XMTP client not found for account "${accountId}"`);
      }

      return client.sendDm(address, text);
    },
  },
};

/**
 * Bridge an inbound XMTP message to the OpenClaw dispatch pipeline.
 */
function handleInboundMessage(
  msg: InboundXmtpMessage,
  account: ResolvedXmtpAccount,
  dispatch: ((envelope: unknown) => void) | undefined,
  logger: { info: (msg: string) => void; debug: (msg: string) => void },
): void {
  logger.debug(
    `Inbound XMTP message: ${msg.messageId} from ${msg.senderAddress ?? msg.senderInboxId}`,
  );

  const envelope = {
    channel: "xmtp",
    accountId: account.accountId,
    type: msg.isDm ? "direct" : "group",
    conversationId: msg.conversationId,
    messageId: msg.messageId,
    sender: {
      address: msg.senderAddress,
      inboxId: msg.senderInboxId,
      displayName: msg.senderAddress,
    },
    text: msg.text,
    timestamp: msg.sentAt.toISOString(),
  };

  if (dispatch) {
    dispatch(envelope);
  } else {
    // TODO: dispatch not available from runtime — log for now
    logger.info(
      `Inbound XMTP (no dispatch): [${msg.senderAddress ?? msg.senderInboxId}] ${msg.text.slice(0, 100)}`,
    );
  }
}

/**
 * Simple text chunking by character limit.
 */
function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a newline
    let breakAt = remaining.lastIndexOf("\n", limit);
    if (breakAt <= 0) {
      // Try to break at a space
      breakAt = remaining.lastIndexOf(" ", limit);
    }
    if (breakAt <= 0) {
      breakAt = limit;
    }

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }

  return chunks;
}
