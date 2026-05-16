import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

import { requireOwner, UnauthorizedError, ForbiddenError } from "@/lib/auth-helpers";
import { buildAuthUrl } from "@/lib/gmail/oauth";

/**
 * GET /api/gmail/connect
 *
 * Owner-only. Generates an OAuth `state` token (a random nonce), stores it in
 * a short-lived httpOnly cookie, and redirects the browser to Google's consent
 * screen. The callback verifies state to prevent CSRF.
 */
export async function GET() {
  try {
    await requireOwner();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", baseUrl()));
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: "Only the owner can connect Gmail" },
        { status: 403 },
      );
    }
    throw err;
  }

  const state = crypto.randomBytes(16).toString("hex");

  const jar = await cookies();
  jar.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return NextResponse.redirect(buildAuthUrl(state));
}

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
