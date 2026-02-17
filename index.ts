import { xmtpChannel } from "./src/channel.js";
import { commands } from "./src/commands.js";
import { runOnboarding } from "./src/onboarding.js";
import { setRuntime } from "./src/runtime.js";
import { xmtpChannelConfigSchema, uiHints } from "./src/config-schema.js";

/**
 * OpenClaw XMTP Channel Plugin
 *
 * Provides encrypted messaging via the XMTP protocol.
 * Uses @xmtp/agent-sdk v2.2.0 — no dependency on private convos-node-sdk.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function register(api: any): void {
  setRuntime(api);

  // Register the XMTP channel
  api.registerChannel({
    ...xmtpChannel,

    configSchema: xmtpChannelConfigSchema,
    uiHints,

    onboarding: {
      async run(ctx: Parameters<typeof runOnboarding>[0]) {
        await runOnboarding(ctx);
      },
    },
  });

  // Register slash commands
  for (const [name, command] of Object.entries(commands)) {
    api.registerCommand({
      name,
      description: command.description,
      handler: command.handler,
    });
  }

  api.logger?.info("XMTP channel plugin registered");
}

// Named exports for direct usage
export { xmtpChannel } from "./src/channel.js";
export { commands } from "./src/commands.js";
export { runOnboarding } from "./src/onboarding.js";
export { xmtpChannelConfigSchema, uiHints } from "./src/config-schema.js";
export type {
  XmtpChannelConfig,
  XmtpAccountConfig,
  ResolvedXmtpAccount,
} from "./src/config-types.js";
