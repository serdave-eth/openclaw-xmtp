import { getClient } from "./clients.js";

// ReactionAction and ReactionSchema are const enums in @xmtp/node-sdk,
// which can't be imported with isolatedModules. Use numeric values directly.
const REACTION_ACTION_ADDED = 1;
const REACTION_SCHEMA_UNICODE = 1;

/**
 * Message tool actions for the XMTP channel.
 */
export const actions = {
  /**
   * Send a text message to a target (conversation ID or wallet address).
   */
  async send(
    accountId: string,
    target: string,
    text: string,
  ): Promise<{ success: boolean; error?: string }> {
    const client = getClient(accountId);
    if (!client) {
      return {
        success: false,
        error: `XMTP client not found for account "${accountId}"`,
      };
    }

    try {
      // If target looks like a wallet address, create/find a DM
      if (target.startsWith("0x") && target.length === 42) {
        await client.sendDm(target as `0x${string}`, text);
      } else {
        // Assume it's a conversation ID
        await client.sendToConversation(target, text);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Send a reaction emoji on a message.
   */
  async react(
    accountId: string,
    conversationId: string,
    _messageId: string,
    emoji: string,
  ): Promise<{ success: boolean; error?: string }> {
    const client = getClient(accountId);
    if (!client) {
      return {
        success: false,
        error: `XMTP client not found for account "${accountId}"`,
      };
    }

    try {
      const ctx = await client.getConversationContext(conversationId);
      if (!ctx) {
        return {
          success: false,
          error: `Conversation not found: ${conversationId}`,
        };
      }

      await ctx.conversation.sendReaction({
        reference: _messageId,
        referenceInboxId: "",
        action: REACTION_ACTION_ADDED,
        content: emoji,
        schema: REACTION_SCHEMA_UNICODE,
      });

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
