import type { XmtpClient } from "./lib/xmtp-client.js";

/**
 * Single source of truth for active XMTP client instances.
 * Used by outbound, actions, and commands — eliminates dual-state.
 */
const clients = new Map<string, XmtpClient>();

export function setClient(accountId: string, client: XmtpClient): void {
  clients.set(accountId, client);
}

export function getClient(accountId: string): XmtpClient | undefined {
  return clients.get(accountId);
}

export function removeClient(accountId: string): boolean {
  return clients.delete(accountId);
}

export function getAllClients(): Map<string, XmtpClient> {
  return clients;
}
