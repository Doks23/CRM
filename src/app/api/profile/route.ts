import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBusinessProfile,
  upsertBusinessProfile,
} from "@/lib/business-profile";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getBusinessProfile();
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can edit profile" }, { status: 403 });

  const body = await req.json();
  const allowedFields = [
    "companyName", "gstin", "fssaiNumber", "certifications",
    "defaultTone", "defaultCurrency", "pitchOneLiner",
    "brandVoice",
    "followUpInfoSentDays", "followUpNegotiationDays", "dailyAiCostCapInr",
    "reorderNudgeDays",
    "classifierProvider", "classifierModel", "drafterProvider", "drafterModel",
    "inboxKeywords",
    "gmailSyncEnabled",
    "pollIntervalMinutes",
    "festiveDates",
    "logoUrl",
  ];

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const updated = await upsertBusinessProfile(
    patch as Parameters<typeof upsertBusinessProfile>[0],
  );
  return NextResponse.json(updated);
}
