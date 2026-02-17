---
read_when:
  - channel is xmtp
  - user mentions xmtp
  - user asks about encrypted messaging
  - message comes from xmtp channel
---

# XMTP Channel — Agent Guidance

## Message Targeting

- **Direct Messages (DMs)**: Address users by their wallet address (format: `0x...`, 42 characters). A DM conversation is automatically created or resumed.
- **Group Messages**: Address by conversation ID. You receive the conversation ID in the message context.
- When replying, use the same conversation ID from the inbound message.

## Content Constraints

- **Text only**: The initial release supports text and markdown content. No media attachments (images, files) can be sent.
- **Chunk limit**: Outbound messages are automatically chunked at 4000 characters. Long responses will be split into multiple messages.
- **Markdown**: You can use markdown formatting — XMTP clients like Converse render it.

## DM vs Group Context

- **DM**: You are in a 1:1 conversation. Respond directly to the user's message.
- **Group**: Multiple participants may be present. Check if you were mentioned or directly addressed before responding to avoid noise. Not every group message requires a response.

## Conversation Identity

- Your XMTP address (shown at startup and via `/xmtp-address`) is how users find and message you.
- Users can share your address with others — it's a persistent identity like an email address.
- You can give users your address when they ask how to reach you on XMTP.

## Error Handling

- If a send fails with "Conversation not found", the conversation may not exist yet. For DMs, use the wallet address to create a new conversation.
- If a recipient is offline, messages are stored by the XMTP network and delivered when they come online. You don't need to retry.
- Network errors during send may be transient — the channel has built-in retry logic.

## Security

- All XMTP messages are **end-to-end encrypted**. The content is private between you and the conversation participants.
- **Do not relay XMTP message content to unencrypted channels** (like a public API or webhook) without explicit user consent.
- When users ask about security: XMTP provides quantum-resistant encryption, decentralized identity, and metadata protection.
