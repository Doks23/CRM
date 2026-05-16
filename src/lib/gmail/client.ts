import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { gmailAccount } from "@/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { newOAuthClient } from "./oauth";

export interface GmailConnection {
  accountId: string;
  email: string;
  gmail: gmail_v1.Gmail;
  auth: OAuth2Client;
  /** Persist the (possibly refreshed) access token. */
  flush: () => Promise<void>;
}

/**
 * Load the shared gmail account row, decrypt the refresh token, and return
 * a Gmail API client. The first call after a token-refresh is responsible for
 * flushing the new access token back to the DB via `flush()`.
 *
 * Returns null if no Gmail account is connected yet.
 */
export async function getGmailConnection(): Promise<GmailConnection | null> {
  const row = await db.query.gmailAccount.findFirst();
  if (!row) return null;

  const refreshToken = decryptSecret(row.encryptedRefreshToken);
  const accessToken = row.encryptedAccessToken
    ? decryptSecret(row.encryptedAccessToken)
    : null;

  const auth = newOAuthClient();
  auth.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken ?? undefined,
    expiry_date: row.accessTokenExpiresAt?.getTime(),
  });

  let pendingFlush: {
    accessToken: string;
    expiresAt: Date | null;
  } | null = null;

  // Capture refreshed tokens so we can re-persist.
  auth.on("tokens", (tokens) => {
    if (tokens.access_token) {
      pendingFlush = {
        accessToken: tokens.access_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      };
    }
  });

  const gmail = google.gmail({ version: "v1", auth });

  return {
    accountId: row.id,
    email: row.email,
    gmail,
    auth,
    async flush() {
      if (!pendingFlush) return;
      await db
        .update(gmailAccount)
        .set({
          encryptedAccessToken: encryptSecret(pendingFlush.accessToken),
          accessTokenExpiresAt: pendingFlush.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(gmailAccount.id, row.id));
      pendingFlush = null;
    },
  };
}

export async function upsertGmailAccount(input: {
  email: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
  connectedByUserId: string;
}): Promise<string> {
  const existing = await db.query.gmailAccount.findFirst();
  const values = {
    email: input.email,
    encryptedRefreshToken: encryptSecret(input.refreshToken),
    encryptedAccessToken: input.accessToken
      ? encryptSecret(input.accessToken)
      : null,
    accessTokenExpiresAt: input.expiresAt,
    connectedByUserId: input.connectedByUserId,
    updatedAt: new Date(),
  };

  if (existing) {
    // Reconnecting (e.g. swapping account or re-authorizing).
    // Reset historyId so the next poll backfills cleanly.
    await db
      .update(gmailAccount)
      .set({ ...values, lastHistoryId: null, lastPolledAt: null })
      .where(eq(gmailAccount.id, existing.id));
    return existing.id;
  }

  const [row] = await db.insert(gmailAccount).values(values).returning();
  return row.id;
}
