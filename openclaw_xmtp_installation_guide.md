# Building Secure Agents with OpenClaw + XMTP

**Nick Molnar** · Dev Notes · Feb 13, 2026 · 3 min read

---

> 💡 XMTP extension only works off the forked repo for now. Use [xmtplabs/openclaw](https://github.com/xmtplabs/openclaw) and branch from [Pull Request #2](https://github.com/xmtplabs/openclaw/pull/2).

## Overview

Build AI agents using OpenClaw's framework that can communicate via XMTP's quantum-resistant, privacy-preserving messaging protocol.

## What is XMTP?

**XMTP (Extensible Message Transport Protocol) is a quantum-resistant, privacy-preserving messaging protocol that enables secure communication between AI agents and users.** It provides end-to-end encrypted messaging that protects against both current and future cryptographic threats while maintaining complete user privacy. XMTP allows agents to communicate directly with users without relying on centralized servers or infrastructure.

## Why use XMTP with OpenClaw?

- **Secure + Private by Default** — End-to-end encryption is built-in. Your agent's conversations are private between the agent and user — you don't need to implement encryption or worry about message security.
- **Give Your Agent a Persistent Messaging Identity** — Your OpenClaw agent gets a persistent messaging identity that users can save, share, and return to — like a phone number or email, but decentralized.

## Security Benefits of XMTP

| Security Feature | What It Means |
|---|---|
| End-to-end encryption by default | Messages are encrypted before leaving your device — only you and your recipient can read them |
| No corporate server access | XMTP can't read your messages, even if compelled to |
| Decentralized storage | Messages stored on-chain/distributed network, not centralized servers |
| Self-sovereign identity | You control your keys and identity, not a platform |
| Metadata protection | Stronger privacy — communication patterns harder to track |
| Open protocol | Transparent, auditable security — no black boxes |
| Credential safety | API keys and secrets never exposed in plaintext to third parties |
| Censorship resistant | No central authority can block or monitor your communications |

## Getting Started

### Installation

XMTP and Convos are not in upstream OpenClaw main yet. Use the fork:

1. Fork `xmtplabs/openclaw`
2. Checkout branch `feat/xmtp-and-convos-extensions` (PR #2)
3. Build: `pnpm install` then `pnpm build`
4. Run OpenClaw from the repo (extensions are under `extensions/` and are used automatically)

> ⚠️ Do not use `npm install -g openclaw` or `openclaw plugins install @openclaw/xmtp` — they won't have XMTP until it's in main.

### Step 1: Configure XMTP Channel

Set up the XMTP channel using OpenClaw's configuration wizard to enable secure messaging capabilities. This creates the foundation for your agent to send and receive encrypted messages.

```bash
# Run the configuration wizard
openclaw configure
```

When prompted:

- **Choose environment:** `Production` or `Dev`
- **Choose keys:**
  - `Random` — automatically generates a new messaging identity and encryption keys for your agent
  - `Custom` — enter your own existing keys if you already have them

The wizard will display your agent's public address. Share this address so others can message your agent via XMTP.

#### Manual Configuration (Optional)

Add to `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "walletKey": "<hex-private-key>",
      "dbEncryptionKey": "<encryption-key>",
      "env": "production"
    }
  }
}
```

### Step 2: Configure DM and Group Policies

Control how your agent handles incoming messages by setting policies for direct messages and group conversations. This determines who can interact with your agent and how it responds to different types of messages.

#### DM Policies

```json
{
  "channels": {
    "xmtp": {
      "dmPolicy": "pairing",
      "allowFrom": ["0x123...", "0x456..."]
    }
  }
}
```

- `pairing` (default): Unknown senders get a pairing code; you approve
- `allowlist`: Only allow senders in `allowFrom` array
- `open`: Accept all incoming DMs
- `disabled`: Ignore all DMs

#### Group Policies

```json
{
  "channels": {
    "xmtp": {
      "groupPolicy": "open",
      "groups": ["*"]
    }
  }
}
```

### Step 3: Start Your Agent

Activate the agent to begin listening for incoming messages. Once started, your agent will automatically process and respond to any messages it receives through XMTP.

```bash
# Start the agent
openclaw start

# Or run in development mode with logs
openclaw start --debug
```

Your agent is now live! The console will show:

- ✅ Agent started
- 📬 Your agent's XMTP address
- 📨 Incoming messages
- 🤖 Agent responses

### Step 4: Advanced Configuration

Customize additional XMTP settings to optimize your agent's behavior. These options control message handling, display settings, and security features.

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "walletKey": "<hex-private-key>",
      "dbEncryptionKey": "<encryption-key>",
      "env": "production",
      "debug": false,
      "dmPolicy": "pairing",
      "groupPolicy": "open",
      "textChunkLimit": 4000,
      "name": "My Agent"
    }
  }
}
```

#### Configuration Options

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable/disable XMTP |
| `walletKey` | string | — | Wallet private key (hex) |
| `dbEncryptionKey` | string | — | DB encryption key for local storage |
| `env` | string | `production` | XMTP environment (production/dev) |
| `debug` | boolean | `false` | Enable debug logging |
| `dmPolicy` | string | `pairing` | DM access policy |
| `allowFrom` | array | — | Allowlist of addresses |
| `groupPolicy` | string | `open` | Group message policy |
| `groups` | array | — | Allowlist of conversation IDs |
| `textChunkLimit` | number | `4000` | Outbound text chunk size |
| `name` | string | — | Display name for this account |

#### Multiple XMTP Identities

```json
{
  "channels": {
    "xmtp": {
      "accounts": {
        "main": {
          "walletKey": "<key1>",
          "dbEncryptionKey": "<key1>",
          "env": "production"
        },
        "support": {
          "walletKey": "<key2>",
          "dbEncryptionKey": "<key2>",
          "env": "production"
        }
      }
    }
  }
}
```

## Complete Setup Example

### Quick Start (Automated)

```bash
# Install OpenClaw and XMTP plugin
npm install -g openclaw
openclaw plugins install @openclaw/xmtp

# Configure XMTP (choose Random keys for quick setup)
openclaw configure

# Start your agent
openclaw start
```

### Custom Setup

```bash
# Install
npm install -g openclaw
openclaw plugins install @openclaw/xmtp

# Create config file at ~/.openclaw/openclaw.json
cat > ~/.openclaw/openclaw.json << EOF
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "walletKey": "0x1234...",
      "dbEncryptionKey": "your-encryption-key",
      "env": "production",
      "dmPolicy": "pairing",
      "groupPolicy": "open",
      "name": "HelpBot"
    }
  }
}
EOF

# Start agent
openclaw start
```

## Testing Your Agent

### Use xmtp.chat (web)

1. Go to [xmtp.chat](https://xmtp.chat)
2. Connect with your wallet or create a new account
3. Start a new conversation
4. Enter your agent's XMTP address
5. Send a message to interact with your agent
