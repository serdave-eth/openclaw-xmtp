import { describe, it, expect } from "vitest";
import { createXmtpUser, generateDbEncryptionKey, normalizeDbEncryptionKey } from "../src/lib/identity.js";
import { resolveDbPath, ensureDbPathWritable } from "../src/lib/db-path.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("identity helpers", () => {
  it("creates a user with a random key", () => {
    const user = createXmtpUser();
    expect(user).toBeDefined();
    expect(user.key).toBeDefined();
    expect(typeof user.key).toBe("string");
    expect(user.key.startsWith("0x")).toBe(true);
  });

  it("creates a user with a provided key", () => {
    const key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const user = createXmtpUser(key);
    expect(user).toBeDefined();
    expect(user.key).toBe(key);
  });

  it("normalizes keys without 0x prefix", () => {
    const key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const user = createXmtpUser(key);
    expect(user).toBeDefined();
  });

  it("generates a valid DB encryption key", () => {
    const key = generateDbEncryptionKey();
    expect(key).toBeDefined();
    expect(key.startsWith("0x")).toBe(true);
    // 0x prefix + 64 hex chars = 66 total
    expect(key.length).toBe(66);
  });

  it("normalizes DB encryption key with 0x prefix", () => {
    const key = normalizeDbEncryptionKey("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    expect(key.startsWith("0x")).toBe(true);
  });

  it("keeps 0x prefix if already present", () => {
    const key = normalizeDbEncryptionKey("0xabcdef");
    expect(key).toBe("0xabcdef");
  });
});

describe("db-path helpers", () => {
  it("resolves DB path with custom state dir", () => {
    const dbPath = resolveDbPath("/tmp/openclaw-test", "dev", "main");
    expect(dbPath).toBe("/tmp/openclaw-test/xmtp/dev/main/xmtp.db");
  });

  it("resolves DB path with default state dir", () => {
    const dbPath = resolveDbPath(undefined, "production", "default");
    const expected = path.join(os.homedir(), ".openclaw", "xmtp", "production", "default", "xmtp.db");
    expect(dbPath).toBe(expected);
  });

  it("ensures DB path parent directory exists", () => {
    const tmpDir = path.join(os.tmpdir(), `openclaw-test-${Date.now()}`);
    const dbPath = path.join(tmpDir, "xmtp", "dev", "test", "xmtp.db");
    ensureDbPathWritable(dbPath);

    const dir = path.dirname(dbPath);
    expect(fs.existsSync(dir)).toBe(true);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// Integration tests — require network access to XMTP dev network
// Skip in CI unless XMTP_TEST=true
describe.skipIf(!process.env.XMTP_TEST)("XmtpClient integration", () => {
  it("creates a client and gets inbox ID", async () => {
    const { XmtpClient } = await import("../src/lib/xmtp-client.js");

    const messages: unknown[] = [];
    const client = new XmtpClient({
      walletKey: createXmtpUser().key,
      dbEncryptionKey: generateDbEncryptionKey(),
      env: "dev",
      accountId: "test",
      stateDir: path.join(os.tmpdir(), `openclaw-xmtp-test-${Date.now()}`),
      onMessage: (msg) => messages.push(msg),
    });

    await client.create();
    const address = client.getAddress();
    expect(address).toBeDefined();
    expect(typeof address).toBe("string");

    await client.stop();
  }, 30000);

  it("starts and stops without error", async () => {
    const { XmtpClient } = await import("../src/lib/xmtp-client.js");

    const client = new XmtpClient({
      walletKey: createXmtpUser().key,
      dbEncryptionKey: generateDbEncryptionKey(),
      env: "dev",
      accountId: "lifecycle-test",
      stateDir: path.join(os.tmpdir(), `openclaw-xmtp-test-${Date.now()}`),
      onMessage: () => {},
    });

    await client.create();
    await client.start();
    await client.stop();
  }, 30000);
});
