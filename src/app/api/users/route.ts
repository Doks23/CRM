import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/db";
import { users, businessProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allUsers = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.createdAt)] });
  const profile = await db.query.businessProfile.findFirst();
  return NextResponse.json({ users: allUsers, allowedEmails: profile?.allowedEmails ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can manage team" }, { status: 403 });

  const { email, name, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 });

  const lowerEmail = email.toLowerCase();

  const existing = await db.query.users.findFirst({ where: eq(users.email, lowerEmail) });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const defaultPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
  const hashed = await hash(defaultPassword, 12);

  const profile = await db.query.businessProfile.findFirst();

  await db.insert(users).values({
    email: lowerEmail,
    name: name || null,
    role,
    hash: hashed,
    active: true,
  });

  if (profile) {
    const current = profile.allowedEmails ?? [];
    if (!current.some((a) => a.email === lowerEmail)) {
      const updated = [...current, { email: lowerEmail, role }];
      await db.update(businessProfile).set({ allowedEmails: updated, updatedAt: new Date() }).where(eq(businessProfile.id, profile.id));
    }
  }

  return NextResponse.json({ email: lowerEmail, defaultPassword });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can manage team" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const lowerEmail = email.toLowerCase();

  await db.delete(users).where(eq(users.email, lowerEmail));

  const profile = await db.query.businessProfile.findFirst();
  if (profile) {
    const updated = (profile.allowedEmails ?? []).filter((a) => a.email !== lowerEmail);
    await db.update(businessProfile).set({ allowedEmails: updated, updatedAt: new Date() }).where(eq(businessProfile.id, profile.id));
  }

  return NextResponse.json({ success: true });
}
