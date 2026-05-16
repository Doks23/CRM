import { NextRequest, NextResponse } from "next/server";
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

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 });

  const profile = await db.query.businessProfile.findFirst();
  if (!profile) return NextResponse.json({ error: "No business profile" }, { status: 500 });

  const current = profile.allowedEmails ?? [];
  if (current.some((a) => a.email === email)) {
    return NextResponse.json({ error: "Already invited" }, { status: 409 });
  }

  const updated = [...current, { email: email.toLowerCase(), role }];
  await db.update(businessProfile).set({ allowedEmails: updated, updatedAt: new Date() }).where(eq(businessProfile.id, profile.id));
  return NextResponse.json({ allowedEmails: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can manage team" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const profile = await db.query.businessProfile.findFirst();
  if (!profile) return NextResponse.json({ error: "No business profile" }, { status: 500 });

  const updated = (profile.allowedEmails ?? []).filter((a) => a.email !== email.toLowerCase());
  await db.update(businessProfile).set({ allowedEmails: updated, updatedAt: new Date() }).where(eq(businessProfile.id, profile.id));
  return NextResponse.json({ allowedEmails: updated });
}
