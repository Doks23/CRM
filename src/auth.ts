import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";

import { authConfig } from "./auth.config";
import { db } from "./db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  allowlist,
} from "./db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT strategy keeps middleware edge-compatible (no DB hit per request).
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const allowed = await db.query.allowlist.findFirst({
        where: eq(allowlist.email, email),
      });
      if (!allowed) return false;

      // Sync role from allowlist onto the user row (idempotent).
      const existing = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (existing) {
        if (existing.role !== allowed.role) {
          await db
            .update(users)
            .set({ role: allowed.role })
            .where(eq(users.id, existing.id));
        }
        if (!existing.active) return false;
      }

      return true;
    },

    async jwt({ token, user }) {
      // On first sign-in `user` is populated; afterwards we read from token.
      if (user?.email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email.toLowerCase()),
          columns: { id: true, role: true, active: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.active = dbUser.active;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? session.user.id;
        session.user.role =
          (token.role as "owner" | "sales" | "production") ?? "sales";
        session.user.active = (token.active as boolean) ?? true;
      }
      return session;
    },
  },
});
