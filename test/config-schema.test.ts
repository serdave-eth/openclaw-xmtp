import { describe, it, expect } from "vitest";
import { xmtpChannelConfigSchema } from "../src/config-schema.js";

describe("xmtpChannelConfigSchema", () => {
  it("accepts a valid full config", () => {
    const config = {
      enabled: true,
      walletKey: "0xabc123",
      dbEncryptionKey: "0xdef456",
      env: "production" as const,
      debug: false,
      dmPolicy: "pairing" as const,
      allowFrom: ["0x123"],
      groupPolicy: "open" as const,
      groupAllowFrom: [],
      groups: ["*"],
      historyLimit: 100,
      textChunkLimit: 4000,
      chunkMode: "length" as const,
      reactionLevel: "minimal" as const,
      name: "My Agent",
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts a valid minimal config", () => {
    const config = {};
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts config with only walletKey and dbEncryptionKey", () => {
    const config = {
      walletKey: "0xabc",
      dbEncryptionKey: "0xdef",
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects invalid env value", () => {
    const config = {
      env: "testnet",
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects invalid dmPolicy value", () => {
    const config = {
      dmPolicy: "reject-all",
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects walletKey as non-string", () => {
    const config = {
      walletKey: 12345,
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("accepts empty accounts object", () => {
    const config = {
      accounts: {},
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts multi-account config", () => {
    const config = {
      env: "production" as const,
      accounts: {
        main: {
          walletKey: "0x1",
          dbEncryptionKey: "0x2",
          dmPolicy: "open" as const,
        },
        support: {
          walletKey: "0x3",
          dbEncryptionKey: "0x4",
          dmPolicy: "pairing" as const,
        },
      },
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects invalid groupPolicy", () => {
    const config = {
      groupPolicy: "invite-only",
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects negative historyLimit", () => {
    const config = {
      historyLimit: -5,
    };
    const result = xmtpChannelConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("accepts all valid env values", () => {
    for (const env of ["production", "dev", "local"] as const) {
      const result = xmtpChannelConfigSchema.safeParse({ env });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid dmPolicy values", () => {
    for (const dmPolicy of ["pairing", "allowlist", "open", "disabled"] as const) {
      const result = xmtpChannelConfigSchema.safeParse({ dmPolicy });
      expect(result.success).toBe(true);
    }
  });
});
