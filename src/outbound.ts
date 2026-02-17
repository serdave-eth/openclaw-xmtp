import { getClient } from "./clients.js";

/**
 * Outbound adapter — sends text messages via XMTP.
 * Reads clients from the shared registry in clients.ts.
 */

export const outbound = {
  deliveryMode: "direct" as const,
  textChunkLimit: 4000,

  /**
   * Send text to a conversation, chunking if needed.
   */
  async sendText(
    accountId: string,
    conversationId: string,
    text: string,
    options?: { textChunkLimit?: number },
  ): Promise<void> {
    const client = getClient(accountId);
    if (!client) {
      throw new Error(
        `XMTP client not found for account "${accountId}". Is the channel started?`,
      );
    }

    const limit = options?.textChunkLimit ?? 4000;
    const chunks = chunkText(text, limit);

    for (const chunk of chunks) {
      await client.sendToConversation(conversationId, chunk);
    }
  },

  /**
   * Send a DM to a wallet address (creates conversation if needed).
   */
  async sendDm(
    accountId: string,
    address: `0x${string}`,
    text: string,
  ): Promise<string> {
    const client = getClient(accountId);
    if (!client) {
      throw new Error(
        `XMTP client not found for account "${accountId}". Is the channel started?`,
      );
    }

    return client.sendDm(address, text);
  },
};

/**
 * Chunk text by character limit, preferring to break at newlines or spaces.
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

    let breakAt = remaining.lastIndexOf("\n", limit);
    if (breakAt <= 0) {
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
