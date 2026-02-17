import { describe, it, expect } from "vitest";
import {
  listAccountIds,
  resolveAccount,
  isAccountConfigured,
  describeAccount,
} from "../src/accounts.js";
import type { XmtpChannelConfig, ResolvedXmtpAccount } from "../src/config-types.js";

describe("listAccountIds", () => {
  it("returns ['default'] for single-account mode", () => {
    const config: XmtpChannelConfig = {
      walletKey: "0xabc",
      dbEncryptionKey: "0xdef",
    };
    expect(listAccountIds(config)).toEqual(["default"]);
  });

  it("returns account keys for multi-account mode", () => {
    const config: XmtpChannelConfig = {
      accounts: {
        main: { walletKey: "0x1", dbEncryptionKey: "0x2" },
        support: { walletKey: "0x3", dbEncryptionKey: "0x4" },
      },
    };
    expect(listAccountIds(config)).toEqual(["main", "support"]);
  });

  it("returns empty array when no walletKey and no accounts", () => {
    const config: XmtpChannelConfig = {
      env: "dev",
    };
    expect(listAccountIds(config)).toEqual([]);
  });

  it("prefers accounts over top-level walletKey", () => {
    const config: XmtpChannelConfig = {
      walletKey: "0xtoplevel",
      accounts: {
        main: { walletKey: "0x1", dbEncryptionKey: "0x2" },
      },
    };
    expect(listAccountIds(config)).toEqual(["main"]);
  });
});

describe("resolveAccount", () => {
  it("returns top-level config for default account", () => {
    const config: XmtpChannelConfig = {
      walletKey: "0xabc",
      dbEncryptionKey: "0xdef",
      env: "dev",
      dmPolicy: "open",
    };
    const account = resolveAccount(config, "default");
    expect(account.accountId).toBe("default");
    expect(account.walletKey).toBe("0xabc");
    expect(account.dbEncryptionKey).toBe("0xdef");
    expect(account.env).toBe("dev");
    expect(account.dmPolicy).toBe("open");
  });

  it("merges top-level defaults with per-account overrides", () => {
    const config: XmtpChannelConfig = {
      env: "production",
      dmPolicy: "pairing",
      accounts: {
        main: {
          walletKey: "0x1",
          dbEncryptionKey: "0x2",
          dmPolicy: "open",
        },
      },
    };
    const account = resolveAccount(config, "main");
    expect(account.walletKey).toBe("0x1");
    expect(account.env).toBe("production"); // inherited from top-level
    expect(account.dmPolicy).toBe("open"); // overridden by account
  });

  it("returns empty keys when account has no keys", () => {
    const config: XmtpChannelConfig = {
      accounts: {
        empty: { env: "dev" },
      },
    };
    const account = resolveAccount(config, "empty");
    expect(account.walletKey).toBe("");
    expect(account.dbEncryptionKey).toBe("");
  });
});

describe("isAccountConfigured", () => {
  it("returns true when both keys are present", () => {
    const account: ResolvedXmtpAccount = {
      accountId: "test",
      walletKey: "0xabc123",
      dbEncryptionKey: "0xdef456",
    };
    expect(isAccountConfigured(account)).toBe(true);
  });

  it("returns false when walletKey is missing", () => {
    const account: ResolvedXmtpAccount = {
      accountId: "test",
      walletKey: "",
      dbEncryptionKey: "0xdef456",
    };
    expect(isAccountConfigured(account)).toBe(false);
  });

  it("returns false when dbEncryptionKey is missing", () => {
    const account: ResolvedXmtpAccount = {
      accountId: "test",
      walletKey: "0xabc123",
      dbEncryptionKey: "",
    };
    expect(isAccountConfigured(account)).toBe(false);
  });
});

describe("describeAccount", () => {
  it("includes account ID", () => {
    const account: ResolvedXmtpAccount = {
      accountId: "main",
      walletKey: "0x1",
      dbEncryptionKey: "0x2",
    };
    expect(describeAccount(account)).toContain("account=main");
  });

  it("includes optional fields when present", () => {
    const account: ResolvedXmtpAccount = {
      accountId: "main",
      walletKey: "0x1",
      dbEncryptionKey: "0x2",
      name: "My Agent",
      env: "dev",
      dmPolicy: "open",
      groupPolicy: "disabled",
    };
    const desc = describeAccount(account);
    expect(desc).toContain('name="My Agent"');
    expect(desc).toContain("env=dev");
    expect(desc).toContain("dm=open");
    expect(desc).toContain("group=disabled");
  });
});
