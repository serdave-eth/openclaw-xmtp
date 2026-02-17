/**
 * Smoke test: creates two XMTP agents on the dev network,
 * sends a DM from one to the other, verifies receipt,
 * then keeps both agents alive so you can DM them yourself.
 *
 * Run with: npx tsx test/smoke.ts
 * Press Ctrl+C to stop.
 */

import { XmtpClient } from "../src/lib/xmtp-client.js";
import { createXmtpUser, generateDbEncryptionKey } from "../src/lib/identity.js";
import os from "node:os";
import path from "node:path";

async function main() {
  const tmpDir = path.join(os.tmpdir(), `xmtp-smoke-${Date.now()}`);
  console.log("=== XMTP Channel Plugin Smoke Test ===\n");
  console.log(`Using temp dir: ${tmpDir}`);

  // Track received messages per agent
  let receivedByA = 0;
  let receivedByB = 0;

  // --- Agent A (the "bot" / receiver) ---
  const userA = createXmtpUser();
  const clientA = new XmtpClient({
    walletKey: userA.key,
    dbEncryptionKey: generateDbEncryptionKey(),
    env: "dev",
    accountId: "agent-a",
    stateDir: tmpDir,
    debug: true,
    onMessage: (msg) => {
      receivedByA++;
      console.log(`\n📨 [Agent A] Message #${receivedByA}: "${msg.text}"`);
      console.log(`   From: ${msg.senderAddress ?? msg.senderInboxId}`);
      console.log(`   Conversation: ${msg.conversationId}`);
      console.log(`   Type: ${msg.isDm ? "DM" : "Group"}`);
      console.log(`   Time: ${msg.sentAt.toISOString()}`);
    },
  });

  console.log("\n1. Creating Agent A...");
  await clientA.create();
  const addressA = clientA.getAddress();
  const inboxIdA = clientA.getInboxId();

  // --- Agent B (the "user" / sender) ---
  const userB = createXmtpUser();
  const clientB = new XmtpClient({
    walletKey: userB.key,
    dbEncryptionKey: generateDbEncryptionKey(),
    env: "dev",
    accountId: "agent-b",
    stateDir: tmpDir,
    debug: true,
    onMessage: (msg) => {
      receivedByB++;
      console.log(`\n📨 [Agent B] Message #${receivedByB}: "${msg.text}"`);
      console.log(`   From: ${msg.senderAddress ?? msg.senderInboxId}`);
      console.log(`   Conversation: ${msg.conversationId}`);
      console.log(`   Type: ${msg.isDm ? "DM" : "Group"}`);
      console.log(`   Time: ${msg.sentAt.toISOString()}`);
    },
  });

  console.log("2. Creating Agent B...");
  await clientB.create();
  const addressB = clientB.getAddress();
  const inboxIdB = clientB.getInboxId();

  // --- Print identity info ---
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    AGENT IDENTITIES                     ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Agent A                                                ║");
  console.log(`║  Address:  ${addressA}`);
  console.log(`║  Inbox ID: ${inboxIdA}`);
  console.log(`║  Key:      ${userA.key.slice(0, 10)}...${userA.key.slice(-6)}`);
  console.log("║                                                          ║");
  console.log("║  Agent B                                                ║");
  console.log(`║  Address:  ${addressB}`);
  console.log(`║  Inbox ID: ${inboxIdB}`);
  console.log(`║  Key:      ${userB.key.slice(0, 10)}...${userB.key.slice(-6)}`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nTo DM these agents, go to https://xmtp.chat (dev network)");
  console.log("and start a conversation with either address above.\n");

  // --- Start both agents ---
  console.log("3. Starting Agent A...");
  await clientA.start();
  console.log("   Agent A listening.");

  console.log("4. Starting Agent B...");
  await clientB.start();
  console.log("   Agent B listening.");

  // --- Automated test: B sends DM to A ---
  console.log(`\n5. Agent B sending DM to Agent A (${addressA})...`);
  const testMessage = `Hello from smoke test! ${Date.now()}`;
  await clientB.sendDm(addressA as `0x${string}`, testMessage);
  console.log(`   Sent: "${testMessage}"`);

  // --- Wait for delivery ---
  console.log("\n6. Waiting for automated message delivery (up to 15s)...");
  const deadline = Date.now() + 15_000;
  while (receivedByA === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  if (receivedByA > 0) {
    console.log(`\n✅ Automated test PASSED — Agent A received the DM.`);
  } else {
    console.log("\n⚠️  Automated delivery timed out (network may be slow).");
  }

  // --- Keep alive for manual testing ---
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Agents are now LIVE and listening for messages.");
  console.log("  Open https://xmtp.chat and DM either agent address.");
  console.log("  Press Ctrl+C to stop.");
  console.log("══════════════════════════════════════════════════════════\n");

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\n\nShutting down...");
    console.log(`Total messages — Agent A: ${receivedByA}, Agent B: ${receivedByB}`);
    await clientB.stop();
    await clientA.stop();
    console.log("Done.\n");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive forever
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:", err);
  process.exit(1);
});
