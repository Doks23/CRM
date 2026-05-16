import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailMessages } from "@/db/schema";
import { auth } from "@/auth";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gmailMessageId } = await req.json();
  if (!gmailMessageId || typeof gmailMessageId !== "string") {
    return NextResponse.json({ error: "gmailMessageId is required" }, { status: 400 });
  }

  const msg = await db.query.emailMessages.findFirst({
    where: eq(emailMessages.gmailMessageId, gmailMessageId),
    columns: { id: true, gmailMessageId: true },
  });
  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await inngest.send({
    name: "ai/classify.requested",
    data: { gmailMessageId },
  });

  return NextResponse.json({ queued: true });
}
