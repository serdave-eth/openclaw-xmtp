import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setXmtpRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getXmtpRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("XMTP runtime not initialized");
  }
  return runtime;
}
