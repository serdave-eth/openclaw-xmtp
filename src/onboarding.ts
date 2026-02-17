import { listAccountIds, resolveAccount, isAccountConfigured } from "./accounts.js";
import { createXmtpUser, createXmtpSigner, generateDbEncryptionKey } from "./lib/identity.js";
import { Agent } from "@xmtp/agent-sdk";

const channel = "xmtp" as const;

/**
 * ChannelOnboardingAdapter for the XMTP channel.
 * Implements getStatus, configure, and disable as expected by
 * openclaw/src/commands/onboarding/registry.ts.
 */
export const xmtpOnboardingAdapter = {
  channel,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getStatus({ cfg }: { cfg: any }) {
    const xmtpCfg = cfg.channels?.xmtp ?? {};
    const accountIds = listAccountIds(xmtpCfg);
    const configured = accountIds.some((id: string) =>
      isAccountConfigured(resolveAccount(xmtpCfg, id)),
    );
    return {
      channel,
      configured,
      statusLines: [`XMTP: ${configured ? "configured" : "needs setup"}`],
      selectionHint: configured ? "configured" : "not configured",
      quickstartScore: 0,
    };
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configure({ cfg, prompter }: { cfg: any; prompter: any }) {
    // Step 1: environment
    const xmtpEnv = await prompter.select({
      message: "XMTP environment",
      options: [
        { value: "production", label: "Production" },
        { value: "dev", label: "Dev" },
      ],
      initialValue: cfg.channels?.xmtp?.env ?? "production",
    });

    // Step 2: key mode
    const keyMode = await prompter.select({
      message: "How would you like to set up keys?",
      options: [
        { value: "random", label: "Generate new identity" },
        { value: "custom", label: "Enter existing keys" },
      ],
    });

    let walletKey: string;
    let dbEncryptionKey: string;

    if (keyMode === "random") {
      const progress = prompter.progress("Generating XMTP identity");
      const user = createXmtpUser();
      walletKey = user.key;
      dbEncryptionKey = generateDbEncryptionKey();

      try {
        const signer = createXmtpSigner(user);
        const agent = await Agent.create(signer, { env: xmtpEnv });
        progress.stop(`Identity created — address: ${agent.address}`);
        await agent.stop();
      } catch {
        progress.stop("Identity created (address will appear on first start)");
      }
    } else {
      walletKey = await prompter.text({
        message: "Wallet private key (hex, 0x-prefixed)",
        validate: (v: string) => (v?.trim() ? undefined : "Required"),
      });
      dbEncryptionKey = await prompter.text({
        message: "DB encryption key (64-char hex or 0x-prefixed)",
        validate: (v: string) => (v?.trim() ? undefined : "Required"),
      });
    }

    // Step 3: DM policy
    const dmPolicy = await prompter.select({
      message: "DM policy",
      options: [
        { value: "pairing", label: "Pairing", hint: "unknown senders get approval code" },
        { value: "open", label: "Open", hint: "accept all DMs" },
        { value: "allowlist", label: "Allowlist", hint: "pre-approved addresses only" },
        { value: "disabled", label: "Disabled", hint: "ignore all DMs" },
      ],
      initialValue: cfg.channels?.xmtp?.dmPolicy ?? "pairing",
    });

    // Step 4: build updated config
    const next = {
      ...cfg,
      channels: {
        ...cfg.channels,
        xmtp: {
          ...cfg.channels?.xmtp,
          enabled: true,
          walletKey,
          dbEncryptionKey,
          env: xmtpEnv,
          dmPolicy,
          groupPolicy: "open",
        },
      },
    };

    await prompter.note(
      [
        "SECURITY: Your config now contains a private key.",
        "For production, consider env var references:",
        '  walletKey: "${XMTP_WALLET_KEY}"',
        '  dbEncryptionKey: "${XMTP_DB_ENCRYPTION_KEY}"',
        "",
        "Run `openclaw doctor --fix` to auto-tighten file permissions.",
      ].join("\n"),
      "XMTP configured",
    );

    return { cfg: next };
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disable: (cfg: any) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      xmtp: { ...cfg.channels?.xmtp, enabled: false },
    },
  }),
};
