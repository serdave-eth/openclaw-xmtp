# openclaw-xmtp

XMTP encrypted messaging channel plugin for [OpenClaw](https://docs.openclaw.ai). Gives your OpenClaw agent a persistent, end-to-end encrypted messaging identity using the [XMTP protocol](https://xmtp.org).

Users message your agent via any XMTP-compatible app using a standard wallet address — no invite links or centralized accounts needed.

**XMTP-compatible apps:**

- [Converse](https://converse.xyz) (mobile)
- [xmtp.chat](https://xmtp.chat) (web)

## How it works

This plugin registers an XMTP channel with OpenClaw's gateway. When started, it:

1. Creates an XMTP agent identity from a wallet private key
2. Streams incoming DMs and group messages via `@xmtp/agent-sdk`
3. Bridges inbound messages into OpenClaw's reply pipeline
4. Sends agent responses back through the encrypted XMTP conversation

All messages are end-to-end encrypted. The plugin uses only the public [`@xmtp/agent-sdk`](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk) — no dependency on the private `convos-node-sdk` or the xmtplabs/openclaw fork.

## Prerequisites

- [OpenClaw](https://docs.openclaw.ai) installed and running
- A running `openclaw-gateway` service
- Node.js >= 22
- An LLM provider API key configured in OpenClaw (e.g. Anthropic)

## Quick start

### Install

> **Note:** This plugin is not yet published to npm. Install from a local clone.

```bash
git clone https://github.com/your-org/openclaw-xmtp.git
cd openclaw-xmtp
npm install
openclaw plugins install -l .
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

### Start the gateway

Restart the gateway to pick up the new config:

```bash
systemctl --user restart openclaw-gateway
```

Check the logs to confirm the XMTP channel connected:

```bash
journalctl --user -u openclaw-gateway -n 50
```

Look for a line like:

```
XMTP account "default" connected (address: 0x...)
```

To find your agent's XMTP address at any time, use the `/xmtp-address` command or check the gateway logs.

### Send your first message

Open [xmtp.chat](https://xmtp.chat) or [Converse](https://converse.xyz), start a conversation with the agent's address, and send a message.

If you're using the **pairing** DM policy (the default), see [Pairing flow](#pairing-flow) below.

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
| `groups` | string[] | — | XMTP conversation IDs to join, or `"*"` for all groups |
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

## Environment variables

Config values like `"${XMTP_WALLET_KEY}"` are resolved from environment variables at startup. Set them in your shell or service environment:

```bash
export XMTP_WALLET_KEY="0x..."
export XMTP_DB_ENCRYPTION_KEY="0x..."
```

This keeps secrets out of the config file on disk.

## DM policies

- **`pairing`** — Unknown senders receive an 8-character code. Approve with `openclaw pairing approve xmtp <CODE>`. Messages from unapproved senders are dropped.
- **`open`** — Accept all incoming DMs.
- **`allowlist`** — Only addresses listed in `allowFrom` can message the agent.
- **`disabled`** — Ignore all DMs.

### Pairing flow

When `dmPolicy` is set to `"pairing"` (the default), new senders must be approved before the agent will respond:

1. A user sends a DM to your agent's XMTP address.
2. The agent replies with an 8-character pairing code (e.g. `A1B2C3D4`).
3. Approve the sender on the host machine:
   ```bash
   openclaw pairing approve xmtp A1B2C3D4
   ```
4. The user sends another message — this time the agent processes it through the LLM and responds normally.

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

## Troubleshooting

**`plugins.entries.xmtp: plugin not found`**
Non-fatal warning during startup. Safe to ignore — the plugin still loads.

**`xmtp configured, not enabled yet`**
Run `openclaw doctor --fix` to enable the channel and fix file permissions.

**No pairing code / no response after messaging the agent**
Check the gateway logs for clues:
```bash
journalctl --user -u openclaw-gateway -n 100
```
Look for `xmtp: drop DM` (sender not approved) or other errors.

**`schema.toJSONSchema is not a function`**
Zod version mismatch. This plugin requires Zod v4 for `toJSONSchema()` compatibility. Run `npm install` in the plugin directory to ensure the correct version is installed.

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
  channel.ts             # Channel plugin definition (adapters, gateway)
  inbound.ts             # Inbound message dispatch pipeline
  accounts.ts            # Multi-account config resolution
  config-types.ts        # TypeScript types
  config-schema.ts       # Zod validation schema + UI hints
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

## License

MIT
