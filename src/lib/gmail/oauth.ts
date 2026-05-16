import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

/**
 * The shared-Gmail OAuth client. This is a DIFFERENT app/credential from the
 * one used to sign team members in via Auth.js — it needs Gmail scopes which
 * trigger Google's verification process. Keep them isolated.
 */

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export function gmailRedirectUri(): string {
  return `${appUrl()}/api/gmail/callback`;
}

export function newOAuthClient(): OAuth2Client {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET are not set",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, gmailRedirectUri());
}

/** Build the consent URL the owner is redirected to when clicking Connect. */
export function buildAuthUrl(state: string): string {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces refresh_token issuance on re-auth
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/**
 * Exchange the OAuth `code` for tokens, then fetch the connected account's
 * email so we can persist who we're synced with.
 */
export async function exchangeCode(code: string): Promise<{
  email: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
}> {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke previous access at " +
        "https://myaccount.google.com/permissions and retry — prompt=consent " +
        "should normally force one.",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();
  const email = profile.email;
  if (!email) throw new Error("Could not read connected Gmail email address");

  return {
    email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}
