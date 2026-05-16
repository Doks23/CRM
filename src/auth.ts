import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { db } from "./db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  type AllowedEmail,
} from "./db/schema";

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = (credentials.email as string)?.toLowerCase();
    const password = credentials.password as string;
    if (!email || !password) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user || !user.hash) return null;
    if (!user.active) return null;

    const valid = await compare(password, user.hash);
    if (!valid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, credentialsProvider],
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

    async signIn({ user, account, profile: googleProfile }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      // Credentials users are already authenticated & active; let them through.
      if (account?.provider === "credentials") return true;

      // Google OAuth: check the allowlist.
      const profile = await db.query.businessProfile.findFirst();
      if (!profile?.allowedEmails) return false;

      const entry = (profile.allowedEmails as AllowedEmail[]).find(
        (e) => e.email === email,
      );
      if (!entry) return false;

      const existing = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existing) {
        if (existing.role !== entry.role) {
          await db
            .update(users)
            .set({ role: entry.role })
            .where(eq(users.id, existing.id));
        }
        if (!existing.active) return "/login?error=pending_approval";
      } else if (entry.role !== "owner") {
        await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email,
            name: (googleProfile as Record<string, unknown>)?.name as string ?? null,
            image: (googleProfile as Record<string, unknown>)?.picture as string ?? null,
            role: entry.role,
            active: false,
          })
          .onConflictDoNothing();
        return "/login?error=pending_approval";
      }

      return true;
    },

    async jwt({ token }) {
      const email = token.email as string | undefined;
      if (email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
          columns: { id: true, role: true, active: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.active = dbUser.active;
        }

        // Sync role from allowedEmails in case the user was created by the
        // adapter with the default role before signIn callback could update it.
        const profile = await db.query.businessProfile.findFirst();
        const entry = (profile?.allowedEmails as AllowedEmail[] | undefined)?.find(
          (e) => e.email === email.toLowerCase(),
        );
        if (entry && dbUser && dbUser.role !== entry.role) {
          await db.update(users).set({ role: entry.role }).where(eq(users.id, dbUser.id));
          token.role = entry.role;
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
