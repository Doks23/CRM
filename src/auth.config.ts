import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe auth config (no database imports) for use in middleware.
 * The full config with DB callbacks lives in src/auth.ts.
 */
export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isOnInngest = nextUrl.pathname.startsWith("/api/inngest");
      const isOnGmailCallback = nextUrl.pathname.startsWith(
        "/api/gmail/callback",
      );

      if (isOnApiAuth || isOnInngest || isOnGmailCallback) return true;
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      if (!isLoggedIn) return false; // middleware will redirect to /login
      return true;
    },
  },
} satisfies NextAuthConfig;
