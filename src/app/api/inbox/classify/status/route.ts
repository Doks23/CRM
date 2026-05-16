import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailMessages } from "@/db/schema";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailMessageId = req.nextUrl.searchParams.get("gmailMessageId");
  if (!gmailMessageId) {
    return NextResponse.json({ error: "gmailMessageId required" }, { status: 400 });
  }

  const msg = await db.query.emailMessages.findFirst({
    where: eq(emailMessages.gmailMessageId, gmailMessageId),
    columns: { aiCategory: true },
  });

  return NextResponse.json({ done: msg?.aiCategory != null });
}
