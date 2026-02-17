/**
 * Module-level getter/setter for PluginRuntime reference.
 * Same pattern used by all OpenClaw channel plugins.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _runtime: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setRuntime(runtime: any): void {
  _runtime = runtime;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRuntime(): any {
  if (!_runtime) {
    throw new Error("XMTP plugin runtime not initialized");
  }
  return _runtime;
}

export function hasRuntime(): boolean {
  return _runtime !== null;
}
