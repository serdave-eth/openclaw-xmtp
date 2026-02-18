import type { ChannelPlugin, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { xmtpPlugin } from "./src/channel.js";
import { setXmtpRuntime } from "./src/runtime.js";
import { commands } from "./src/commands.js";

const plugin = {
  id: "openclaw-xmtp",
  name: "XMTP",
  description: "XMTP encrypted messaging channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setXmtpRuntime(api.runtime);
    api.registerChannel({ plugin: xmtpPlugin as ChannelPlugin });

    // Register slash commands
    for (const [name, command] of Object.entries(commands)) {
      api.registerCommand({
        name,
        description: command.description,
        handler: command.handler,
      });
    }

    api.logger?.info("XMTP channel plugin registered");
  },
};

export default plugin;

export type {
  XmtpChannelConfig,
  XmtpAccountConfig,
  ResolvedXmtpAccount,
} from "./src/config-types.js";
