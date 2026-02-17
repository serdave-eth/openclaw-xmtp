# openclaw-xmtp

XMTP encrypted messaging channel plugin for [OpenClaw](https://docs.openclaw.ai). Gives your OpenClaw agent a persistent, end-to-end encrypted messaging identity using the [XMTP protocol](https://xmtp.org).

Users message your agent via any XMTP-compatible app (Converse, xmtp.chat, etc.) using a standard wallet address — no invite links or centralized accounts needed.

## How it works

This plugin registers an XMTP channel with OpenClaw's gateway. When started, it:

1. Creates an XMTP agent identity from a wallet private key
2. Streams incoming DMs and group messages via `@xmtp/agent-sdk`
3. Bridges inbound messages into OpenClaw's reply pipeline
4. Sends agent responses back through the encrypted XMTP conversation

All messages are end-to-end encrypted. The plugin uses only the public [`@xmtp/agent-sdk`](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk) — no dependency on the private `convos-node-sdk` or the xmtplabs/openclaw fork.

## Quick start

### Install

```bash
openclaw plugins install openclaw-xmtp
```

Or install from a local clone:

```bash
openclaw plugins install -l /path/to/openclaw-xmtp
```

### Configure

```bash
openclaw configure
```

Select **XMTP (Encrypted Messaging)**, choose **Random** to generate a fresh identity, and pick a DM policy. The wizard will display your agent's XMTP address.

Or configure manually in `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "walletKey": "${XMTP_WALLET_KEY}",
      "dbEncryptionKey": "${XMTP_DB_ENCRYPTION_KEY}",
      "env": "production",
      "dmPolicy": "pairing"
    }
  }
}
```

### Start

```bash
openclaw start
```

Your agent is now reachable at its XMTP address. Open [xmtp.chat](https://xmtp.chat) or Converse, start a conversation with the address, and send a message.

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable/disable the channel |
| `walletKey` | string | — | Hex private key (supports `${ENV_VAR}` references) |
| `dbEncryptionKey` | string | — | 64-char hex key for local DB encryption |
| `env` | string | `"production"` | XMTP network: `"production"`, `"dev"`, or `"local"` |
| `dmPolicy` | string | `"pairing"` | `"pairing"`, `"open"`, `"allowlist"`, or `"disabled"` |
| `allowFrom` | string[] | — | Wallet addresses for allowlist policy |
| `groupPolicy` | string | `"open"` | `"open"`, `"disabled"`, or `"allowlist"` |
| `groups` | string[] | — | Conversation IDs or `"*"` |
| `textChunkLimit` | number | `4000` | Max characters per outbound message chunk |
| `name` | string | — | Display name for this account |
| `debug` | boolean | `false` | Enable debug logging |

### Multiple accounts

```json
{
  "channels": {
    "xmtp": {
      "env": "production",
      "accounts": {
        "main": {
          "walletKey": "${XMTP_MAIN_KEY}",
          "dbEncryptionKey": "${XMTP_MAIN_DB_KEY}",
          "dmPolicy": "pairing"
        },
        "support": {
          "walletKey": "${XMTP_SUPPORT_KEY}",
          "dbEncryptionKey": "${XMTP_SUPPORT_DB_KEY}",
          "dmPolicy": "open"
        }
      }
    }
  }
}
```

## DM policies

- **`pairing`** — Unknown senders receive an 8-character code. Approve with `openclaw pairing approve xmtp <CODE>`. Messages from unapproved senders are dropped.
- **`open`** — Accept all incoming DMs.
- **`allowlist`** — Only addresses listed in `allowFrom` can message the agent.
- **`disabled`** — Ignore all DMs.

## Commands

| Command | Description |
|---|---|
| `/xmtp-address` | Show the agent's XMTP address and inbox ID |
| `/xmtp-groups` | List active conversations |

## Security

- **End-to-end encrypted** — All XMTP messages are encrypted; only conversation participants can read them.
- **Use env var references** — Store keys as `"${XMTP_WALLET_KEY}"` instead of plaintext in config. OpenClaw resolves them at startup.
- **File permissions** — Run `openclaw doctor --fix` to enforce `chmod 600` on config files.
- Credential fields are marked `sensitive` in the config schema so the Control UI masks them.

## Development

```bash
# Install dependencies
npm install

# Run unit tests
npx vitest run

# Run integration tests (requires XMTP dev network access)
XMTP_TEST=true npx vitest run

# Smoke test — creates two agents, sends a DM, then stays alive for manual testing
npx tsx test/smoke.ts

# Type check
npx tsc --noEmit
```

## Project structure

```
index.ts                 # Entry point — registers channel + commands
openclaw.plugin.json     # Plugin manifest
src/
  channel.ts             # Channel plugin definition (gateway, outbound)
  accounts.ts            # Multi-account config resolution
  config-types.ts        # TypeScript types
  config-schema.ts       # Zod validation schema + UI hints
  outbound.ts            # Outbound message delivery
  actions.ts             # Message tool actions (send, react)
  onboarding.ts          # `openclaw configure` wizard
  commands.ts            # Slash commands
  runtime.ts             # Plugin runtime state
  clients.ts             # Client instance registry
  lib/
    xmtp-client.ts       # XMTP Agent SDK wrapper
    identity.ts          # Key generation + signer helpers
    db-path.ts           # DB path resolution
test/
  accounts.test.ts       # Config resolution tests
  config-schema.test.ts  # Zod schema validation tests
  xmtp-client.test.ts    # Identity + DB path unit tests
  smoke.ts               # Interactive smoke test
skills/
  xmtp-channel.md        # Agent skill guidance
```

## Requirements

- Node.js >= 22
- OpenClaw

## License

MIT
