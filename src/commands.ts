import { getAllClients } from "./clients.js";

/**
 * Slash commands for the XMTP channel.
 */
export const commands = {
  /**
   * /xmtp-address — Show the XMTP inbox ID / address for each account.
   */
  "xmtp-address": {
    description: "Show XMTP agent address(es)",
    async handler(): Promise<string> {
      const clients = getAllClients();
      if (clients.size === 0) {
        return "No XMTP accounts are currently connected.";
      }

      const lines: string[] = ["XMTP Agent Addresses:"];
      for (const [accountId, client] of clients) {
        const address = client.getAddress();
        const inboxId = client.getInboxId();
        lines.push(`  ${accountId}: ${address ?? "unknown"}`);
        if (inboxId) {
          lines.push(`    inbox: ${inboxId}`);
        }
      }
      return lines.join("\n");
    },
  },

  /**
   * /xmtp-groups — List active conversations for each account.
   */
  "xmtp-groups": {
    description: "List XMTP conversations",
    async handler(): Promise<string> {
      const clients = getAllClients();
      if (clients.size === 0) {
        return "No XMTP accounts are currently connected.";
      }

      const lines: string[] = ["XMTP Conversations:"];
      for (const [accountId] of clients) {
        lines.push(`  Account: ${accountId}`);
        lines.push("    (Use XMTP client apps to view full conversation list)");
      }
      return lines.join("\n");
    },
  },
};
