import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { leads } from "@/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    contactName?: string;
    company?: string;
    leadType?: string;
  };

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const validLeadTypes = ["bulk", "retail", "inquiry", "partnership", "export", "sample_request"];
  const leadType = validLeadTypes.includes(body.leadType ?? "") ? (body.leadType as "bulk" | "retail" | "inquiry" | "partnership" | "export" | "sample_request") : "inquiry";

  try {
    const [lead] = await db
      .insert(leads)
      .values({
        id: crypto.randomUUID(),
        primaryEmail: email,
        contactName: body.contactName?.trim() || null,
        company: body.company?.trim() || null,
        leadType,
        source: "unknown",
        stage: "new",
        assignedUserId: session.user.id,
        lastActivityAt: new Date(),
        firstContactAt: new Date(),
      })
      .returning({ id: leads.id });

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "A lead with this email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
