import {
  Agent,
  filter,
  type MessageContext,
  type ConversationContext,
  type Dm,
  type Group,
} from "@xmtp/agent-sdk";

import { createXmtpUser, createXmtpSigner, normalizeDbEncryptionKey } from "./identity.js";
import { resolveDbPath, ensureDbPathWritable } from "./db-path.js";

export type XmtpClientOptions = {
  walletKey: string;
  dbEncryptionKey: string;
  env: "production" | "dev" | "local";
  accountId: string;
  stateDir?: string;
  debug?: boolean;
  onMessage: (msg: InboundXmtpMessage) => void;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
};

export type InboundXmtpMessage = {
  text: string;
  senderAddress: string | undefined;
  senderInboxId: string;
  conversationId: string;
  messageId: string;
  isDm: boolean;
  isGroup: boolean;
  sentAt: Date;
};

const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;

export class XmtpClient {
  private agent: Agent | null = null;
  private opts: XmtpClientOptions;
  private log: NonNullable<XmtpClientOptions["logger"]>;

  constructor(opts: XmtpClientOptions) {
    this.opts = opts;
    this.log = opts.logger ?? {
      info: (msg: string) => console.log(`[xmtp:${opts.accountId}] ${msg}`),
      warn: (msg: string) => console.warn(`[xmtp:${opts.accountId}] ${msg}`),
      error: (msg: string) => console.error(`[xmtp:${opts.accountId}] ${msg}`),
      debug: (msg: string) => {
        if (opts.debug) console.debug(`[xmtp:${opts.accountId}] ${msg}`);
      },
    };
  }

  /**
   * Create the XMTP Agent and register message handlers.
   * Does NOT start streaming — call start() after create().
   */
  async create(): Promise<void> {
    const user = createXmtpUser(this.opts.walletKey);
    const signer = createXmtpSigner(user);

    const dbPath = resolveDbPath(
      this.opts.stateDir,
      this.opts.env,
      this.opts.accountId,
    );
    ensureDbPathWritable(dbPath);

    const dbEncryptionKey = normalizeDbEncryptionKey(this.opts.dbEncryptionKey);

    this.log.info(`Creating XMTP agent (env: ${this.opts.env}, db: ${dbPath})`);

    this.agent = await Agent.create(signer, {
      env: this.opts.env,
      dbPath,
      dbEncryptionKey,
    });

    // Register text message handler
    this.agent.on("text", async (ctx: MessageContext<string>) => {
      try {
        await this.handleIncomingMessage(ctx);
      } catch (err) {
        this.log.error(`Error handling text message: ${err}`);
      }
    });

    // Register markdown handler (Converse and other clients may send markdown)
    this.agent.on("markdown", async (ctx: MessageContext<string>) => {
      try {
        await this.handleIncomingMessage(ctx);
      } catch (err) {
        this.log.error(`Error handling markdown message: ${err}`);
      }
    });

    // Register error handler
    this.agent.on("unhandledError", (error: Error) => {
      this.log.error(`Unhandled XMTP error: ${error.message}`);
    });

    this.log.info(`XMTP agent created (address: ${this.agent.address})`);
  }

  /**
   * Start streaming messages with retry logic.
   */
  async start(): Promise<void> {
    if (!this.agent) {
      throw new Error("Agent not created. Call create() first.");
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
      try {
        this.log.info(
          `Starting XMTP agent (attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS})`,
        );
        await this.agent.start();
        this.log.info("XMTP agent started successfully");
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log.warn(
          `Start attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.log.info(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    this.log.error(
      `Failed to start XMTP agent after ${DEFAULT_RETRY_ATTEMPTS} attempts`,
    );
    throw lastError;
  }

  /**
   * Graceful shutdown.
   */
  async stop(): Promise<void> {
    if (this.agent) {
      this.log.info("Stopping XMTP agent");
      await this.agent.stop();
      this.agent = null;
    }
  }

  /**
   * Send a text message to an existing conversation.
   */
  async sendToConversation(
    conversationId: string,
    text: string,
  ): Promise<void> {
    if (!this.agent) {
      throw new Error("Agent not started");
    }

    const ctx = await this.agent.getConversationContext(conversationId);
    if (!ctx) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    await ctx.conversation.sendText(text);
  }

  /**
   * Create a new DM with a wallet address and send a message.
   */
  async sendDm(address: `0x${string}`, text: string): Promise<string> {
    if (!this.agent) {
      throw new Error("Agent not started");
    }

    const dm = await this.agent.createDmWithAddress(address);
    await dm.sendText(text);
    return dm.id;
  }

  /**
   * Get the agent's XMTP inbox ID / address.
   */
  getAddress(): string | undefined {
    return this.agent?.address;
  }

  /**
   * Get the agent's inbox ID from the underlying client.
   */
  getInboxId(): string | undefined {
    return this.agent?.client?.inboxId;
  }

  /**
   * Get a conversation context by ID.
   */
  async getConversationContext(conversationId: string) {
    if (!this.agent) {
      throw new Error("Agent not started");
    }
    return this.agent.getConversationContext(conversationId);
  }

  /**
   * Internal: handle an incoming text or markdown message.
   */
  private async handleIncomingMessage(
    ctx: MessageContext<string>,
  ): Promise<void> {
    // Filter out self-echo
    if (filter.fromSelf(ctx.message, ctx.client)) {
      this.log.debug("Filtered self-echo message");
      return;
    }

    const senderAddress = await ctx.getSenderAddress();
    const conversationId = ctx.message.conversationId;

    this.log.debug(
      `Received message from ${senderAddress ?? ctx.message.senderInboxId} in ${conversationId}`,
    );

    const inbound: InboundXmtpMessage = {
      text: ctx.message.content,
      senderAddress,
      senderInboxId: ctx.message.senderInboxId,
      conversationId,
      messageId: ctx.message.id,
      isDm: ctx.isDm(),
      isGroup: ctx.isGroup(),
      sentAt: ctx.message.sentAt,
    };

    this.opts.onMessage(inbound);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
