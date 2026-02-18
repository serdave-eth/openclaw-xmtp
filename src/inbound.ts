import {
  createReplyPrefixOptions,
  logInboundDrop,
  resolveControlCommandGate,
  type OpenClawConfig,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import type { ResolvedXmtpAccount } from "./config-types.js";
import type { InboundXmtpMessage } from "./lib/xmtp-client.js";
import { getXmtpRuntime } from "./runtime.js";
import { getClient } from "./clients.js";

const CHANNEL_ID = "xmtp" as const;

/**
 * Normalize an allowlist entry for comparison.
 */
function normalizeAllowEntry(entry: string): string {
  return String(entry).toLowerCase().trim();
}

/**
 * Check if a sender matches any entry in an allowlist.
 */
function matchesAllowlist(
  senderId: string,
  allowFrom: string[],
): boolean {
  const senderLower = senderId.toLowerCase();
  return allowFrom.some((a) => senderLower.includes(a));
}

/**
 * Deliver a reply back to an XMTP conversation.
 * XMTP only supports text, so media URLs are appended inline.
 */
async function deliverXmtpReply(params: {
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
  conversationId: string;
  accountId: string;
}): Promise<void> {
  const text = params.payload.text ?? "";
  const mediaList = params.payload.mediaUrls?.length
    ? params.payload.mediaUrls
    : params.payload.mediaUrl
      ? [params.payload.mediaUrl]
      : [];

  if (!text.trim() && mediaList.length === 0) return;

  // XMTP is text-only — append media URLs inline
  const mediaBlock = mediaList.length
    ? mediaList.map((url) => `Attachment: ${url}`).join("\n")
    : "";
  const combined = text.trim()
    ? mediaBlock
      ? `${text.trim()}\n\n${mediaBlock}`
      : text.trim()
    : mediaBlock;

  const client = getClient(params.accountId);
  if (!client) return;
  await client.sendToConversation(params.conversationId, combined);
}

/**
 * Full inbound dispatch pipeline for XMTP messages.
 * Modeled on extensions/irc/src/inbound.ts.
 */
export async function handleXmtpInbound(params: {
  message: InboundXmtpMessage;
  account: ResolvedXmtpAccount;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
}): Promise<void> {
  const { message, account, config, runtime } = params;
  const core = getXmtpRuntime();

  const rawBody = message.text?.trim() ?? "";
  if (!rawBody) return;

  const senderId = message.senderAddress ?? message.senderInboxId;
  const dmPolicy = account.dmPolicy ?? "pairing";
  const groupPolicy = account.groupPolicy ?? "open";

  // Build effective allowlists from config + pairing store
  const configAllowFrom = (account.allowFrom ?? []).map(normalizeAllowEntry);
  const storeAllowFrom = await core.channel.pairing
    .readAllowFromStore(CHANNEL_ID)
    .catch(() => []);
  const effectiveAllowFrom = [
    ...configAllowFrom,
    ...storeAllowFrom.map((s) => normalizeAllowEntry(String(s))),
  ];

  const configGroupAllowFrom = (account.groupAllowFrom ?? []).map(normalizeAllowEntry);
  const effectiveGroupAllowFrom = [
    ...configGroupAllowFrom,
    ...storeAllowFrom.map((s) => normalizeAllowEntry(String(s))),
  ];

  // ── DM policy gating ──
  if (message.isDm) {
    if (dmPolicy === "disabled") {
      runtime.log?.(`xmtp: drop DM sender=${senderId} (dmPolicy=disabled)`);
      return;
    }

    if (dmPolicy !== "open") {
      const dmAllowed = matchesAllowlist(senderId, effectiveAllowFrom);

      if (!dmAllowed) {
        if (dmPolicy === "pairing") {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: CHANNEL_ID,
            id: senderId,
            meta: { name: senderId },
          });
          if (created) {
            try {
              const reply = core.channel.pairing.buildPairingReply({
                channel: CHANNEL_ID,
                idLine: `Your XMTP address: ${senderId}`,
                code,
              });
              await deliverXmtpReply({
                payload: { text: reply },
                conversationId: message.conversationId,
                accountId: account.accountId,
              });
            } catch (err) {
              runtime.error?.(`xmtp: pairing reply failed: ${String(err)}`);
            }
          }
        }
        runtime.log?.(`xmtp: drop DM sender=${senderId} (dmPolicy=${dmPolicy})`);
        return;
      }
    }
  } else {
    // ── Group policy gating ──
    if (groupPolicy === "disabled") {
      runtime.log?.(`xmtp: drop group ${message.conversationId} (groupPolicy=disabled)`);
      return;
    }

    if (groupPolicy === "allowlist") {
      const senderAllowed = matchesAllowlist(senderId, effectiveGroupAllowFrom);
      if (!senderAllowed) {
        runtime.log?.(
          `xmtp: drop group sender=${senderId} in ${message.conversationId} (groupPolicy=allowlist)`,
        );
        return;
      }
    }
  }

  // ── Command gating ──
  const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
    cfg: config,
    surface: CHANNEL_ID,
  });
  const hasControlCommand = core.channel.text.hasControlCommand(rawBody, config);

  // Determine if sender is in the effective allowlist for command authorization
  const senderInAllowlist = message.isDm
    ? matchesAllowlist(senderId, effectiveAllowFrom)
    : matchesAllowlist(senderId, effectiveGroupAllowFrom);
  const allowlistConfigured = message.isDm
    ? effectiveAllowFrom.length > 0
    : effectiveGroupAllowFrom.length > 0;

  const commandGate = resolveControlCommandGate({
    useAccessGroups: (config as any).commands?.useAccessGroups !== false,
    authorizers: [
      {
        configured: allowlistConfigured,
        allowed: senderInAllowlist,
      },
    ],
    allowTextCommands,
    hasControlCommand,
  });
  const commandAuthorized = commandGate.commandAuthorized;

  if (message.isGroup && commandGate.shouldBlock) {
    logInboundDrop({
      log: (line) => runtime.log?.(line),
      channel: CHANNEL_ID,
      reason: "control command (unauthorized)",
      target: senderId,
    });
    return;
  }

  // ── Agent routing ──
  const peerId = message.isDm ? senderId : message.conversationId;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: message.isDm ? "direct" : "group",
      id: peerId,
    },
  });

  // ── Build envelope ──
  const storePath = core.channel.session.resolveStorePath(
    (config as any).session?.store,
    { agentId: route.agentId },
  );
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const conversationLabel = message.isDm ? senderId : message.conversationId;
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "XMTP",
    from: message.isDm ? senderId : conversationLabel,
    timestamp: message.sentAt.getTime(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  // ── Finalize context ──
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: message.isDm ? `xmtp:${senderId}` : `xmtp:group:${message.conversationId}`,
    To: `xmtp:${peerId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: message.isDm ? "direct" : "group",
    ConversationLabel: conversationLabel,
    SenderName: senderId,
    SenderId: senderId,
    GroupSubject: message.isGroup ? message.conversationId : undefined,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: message.messageId,
    Timestamp: message.sentAt.getTime(),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `xmtp:${peerId}`,
    CommandAuthorized: commandAuthorized,
  });

  // ── Record session ──
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`xmtp: failed updating session meta: ${String(err)}`);
    },
  });

  // ── Reply prefix ──
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: account.accountId,
  });

  // ── Dispatch to LLM ──
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload) => {
        await deliverXmtpReply({
          payload: payload as {
            text?: string;
            mediaUrls?: string[];
            mediaUrl?: string;
          },
          conversationId: message.conversationId,
          accountId: account.accountId,
        });
      },
      onError: (err, info) => {
        runtime.error?.(`xmtp ${info.kind} reply failed: ${String(err)}`);
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}
