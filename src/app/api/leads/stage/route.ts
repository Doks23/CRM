import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { leads } from "@/db/schema";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, stage } = body;

  if (!leadId || !stage) {
    return NextResponse.json(
      { error: "leadId and stage are required" },
      { status: 400 },
    );
  }

  const validStages = [
    "new", "info_sent", "negotiation", "po", "dispatched", "ignored",
  ] as const;

  if (!validStages.includes(stage)) {
    return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 });
  }

  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db
    .update(leads)
    .set({ stage, lastActivityAt: new Date() })
    .where(eq(leads.id, leadId));

  return NextResponse.json({ status: "ok", leadId, stage });
}
