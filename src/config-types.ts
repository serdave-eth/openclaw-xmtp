export type XmtpAccountConfig = {
  name?: string;
  enabled?: boolean;
  walletKey?: string;
  dbEncryptionKey?: string;
  env?: "production" | "dev" | "local";
  debug?: boolean;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];
  groupPolicy?: "open" | "disabled" | "allowlist";
  groupAllowFrom?: string[];
  groups?: string[];
  historyLimit?: number;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  reactionLevel?: "off" | "ack" | "minimal" | "extensive";
};

export type XmtpChannelConfig = XmtpAccountConfig & {
  accounts?: Record<string, XmtpAccountConfig>;
};

export type ResolvedXmtpAccount = Required<
  Pick<XmtpAccountConfig, "walletKey" | "dbEncryptionKey">
> &
  Omit<XmtpAccountConfig, "walletKey" | "dbEncryptionKey"> & {
    accountId: string;
  };
