import { createXmtpUser, createXmtpSigner, generateDbEncryptionKey } from "./lib/identity.js";
import { Agent } from "@xmtp/agent-sdk";

export type OnboardingContext = {
  prompt: (question: string, options?: string[]) => Promise<string>;
  print: (message: string) => void;
  writeConfig: (path: string, value: unknown) => Promise<void>;
  configPath?: string;
};

/**
 * Interactive onboarding wizard for `openclaw configure`.
 * Guides the user through XMTP setup.
 */
export async function runOnboarding(ctx: OnboardingContext): Promise<void> {
  ctx.print("\n--- XMTP Channel Configuration ---\n");

  // Step 1: Choose environment
  const env = await ctx.prompt("Choose XMTP environment:", [
    "production",
    "dev",
  ]);
  const xmtpEnv = env === "dev" ? "dev" : "production";

  // Step 2: Choose key mode
  const keyMode = await ctx.prompt("How would you like to set up keys?", [
    "Random (generate new identity)",
    "Custom (enter existing keys)",
  ]);

  let walletKey: string;
  let dbEncryptionKey: string;

  if (keyMode.startsWith("Random")) {
    // Generate random keys
    ctx.print("Generating new XMTP identity...");

    const user = createXmtpUser();
    walletKey = user.key;
    dbEncryptionKey = generateDbEncryptionKey();

    ctx.print(`Wallet key generated: ${walletKey.slice(0, 10)}...`);
    ctx.print(`DB encryption key generated: ${dbEncryptionKey.slice(0, 10)}...`);

    // Create a temporary agent to get the inbox ID
    try {
      const signer = createXmtpSigner(user);
      const agent = await Agent.create(signer, { env: xmtpEnv });
      const address = agent.address;
      ctx.print(`\nYour agent's XMTP address: ${address}`);
      ctx.print("Share this address so others can message your agent.\n");
      await agent.stop();
    } catch {
      ctx.print(
        "\nCould not retrieve XMTP address (network unavailable). " +
          "It will be shown when you start the agent.\n",
      );
    }
  } else {
    // Custom keys
    walletKey = await ctx.prompt(
      "Enter wallet private key (hex, 0x-prefixed):",
    );
    dbEncryptionKey = await ctx.prompt(
      "Enter DB encryption key (64-char hex or 0x-prefixed):",
    );
  }

  // Step 3: Choose DM policy
  const dmPolicy = await ctx.prompt("Choose DM policy:", [
    "pairing (unknown senders get a code to approve)",
    "open (accept all DMs)",
    "allowlist (only pre-approved addresses)",
    "disabled (ignore all DMs)",
  ]);

  const dmPolicyValue = dmPolicy.split(" ")[0] as
    | "pairing"
    | "open"
    | "allowlist"
    | "disabled";

  // Step 4: Write config
  const config = {
    enabled: true,
    walletKey,
    dbEncryptionKey,
    env: xmtpEnv,
    dmPolicy: dmPolicyValue,
    groupPolicy: "open" as const,
  };

  await ctx.writeConfig("channels.xmtp", config);

  ctx.print("\nXMTP channel configured successfully!");
  ctx.print("");
  ctx.print("SECURITY NOTES:");
  ctx.print(
    '  Your config file contains a private key. For production use, consider',
  );
  ctx.print(
    '  using env var references instead:',
  );
  ctx.print('    walletKey: "${XMTP_WALLET_KEY}"');
  ctx.print('    dbEncryptionKey: "${XMTP_DB_ENCRYPTION_KEY}"');
  ctx.print("");
  ctx.print(
    "  Run `openclaw doctor --fix` to auto-tighten file permissions.",
  );
  ctx.print("");
  ctx.print("Start your agent with: openclaw start");
}
