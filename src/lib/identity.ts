import { createUser, createSigner, createIdentifier } from "@xmtp/agent-sdk";
import crypto from "node:crypto";

import type { User, Signer, Identifier } from "@xmtp/agent-sdk";

export type { User, Signer, Identifier };

/**
 * Create a User from an optional hex private key.
 * If no key is provided, generates a random one.
 */
export function createXmtpUser(walletKey?: string): User {
  if (walletKey) {
    const key = walletKey.startsWith("0x")
      ? (walletKey as `0x${string}`)
      : (`0x${walletKey}` as `0x${string}`);
    return createUser(key);
  }
  return createUser();
}

/**
 * Create a Signer from a User (required by Agent.create).
 */
export function createXmtpSigner(user: User): Signer {
  return createSigner(user);
}

/**
 * Create an Identifier from a User.
 */
export function createXmtpIdentifier(user: User): Identifier {
  return createIdentifier(user);
}

/**
 * Generate a random 32-byte DB encryption key as a hex string.
 * Returns a 0x-prefixed 66-character string (0x + 64 hex chars).
 */
export function generateDbEncryptionKey(): string {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Normalize a DB encryption key to 0x-prefixed hex format.
 */
export function normalizeDbEncryptionKey(key: string): `0x${string}` {
  return key.startsWith("0x")
    ? (key as `0x${string}`)
    : (`0x${key}` as `0x${string}`);
}
