import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { requireOwner, ForbiddenError, UnauthorizedError } from "@/lib/auth-helpers";
import { exchangeCode } from "@/lib/gmail/oauth";
import { upsertGmailAccount } from "@/lib/gmail/client";
import { inngest } from "@/inngest/client";

/**
 * GET /api/gmail/callback
 *
 * Google redirects here with `code` + `state` after the owner consents. We
 * verify state against the cookie set in /connect, exchange the code for a
 * refresh token, encrypt it, and persist.
 */
export async function GET(req: NextRequest) {
  const settingsUrl = new URL("/settings", baseUrl());

  let session;
  try {
    session = await requireOwner();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", baseUrl()));
    }
    if (err instanceof ForbiddenError) {
      settingsUrl.searchParams.set("gmail_error", "forbidden");
      return NextResponse.redirect(settingsUrl);
    }
    throw err;
  }

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    settingsUrl.searchParams.set("gmail_error", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code) {
    settingsUrl.searchParams.set("gmail_error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  const jar = await cookies();
  const storedState = jar.get("gmail_oauth_state")?.value;
  jar.delete("gmail_oauth_state");

  if (!storedState || storedState !== state) {
    settingsUrl.searchParams.set("gmail_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCode(code);
    await upsertGmailAccount({
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      connectedByUserId: session.user.id,
    });
    // Kick off the first backfill right away rather than waiting for the
    // next cron tick.
    await inngest.send({
      name: "gmail/sync.requested",
      data: { reason: "callback", triggeredByUserId: session.user.id },
    });
  } catch (err) {
    settingsUrl.searchParams.set(
      "gmail_error",
      err instanceof Error ? err.message.slice(0, 200) : "exchange_failed",
    );
    return NextResponse.redirect(settingsUrl);
  }

  settingsUrl.searchParams.set("gmail_connected", "1");
  return NextResponse.redirect(settingsUrl);
}

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
