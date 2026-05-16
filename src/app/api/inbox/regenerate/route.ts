import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";

import { db } from "@/db";
import { emailMessages, leads, products, aiDrafts } from "@/db/schema";
import { draft, AiCostCapExceededError } from "@/lib/ai";
import type { AiCategory, LeadType, LeadLanguage, Urgency } from "@/lib/ai/types";
import { loadRecentEditExamples } from "@/lib/ai/tone-learning";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, inReplyToMessageId, instructions } = body as {
    leadId: string;
    inReplyToMessageId: string;
    instructions?: string;
  };

  if (!leadId || !inReplyToMessageId) {
    return NextResponse.json(
      { error: "leadId and inReplyToMessageId are required" },
      { status: 400 },
    );
  }

  try {
    const message = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.id, inReplyToMessageId),
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const threadMessages = await db.query.emailMessages.findMany({
      where: eq(emailMessages.gmailThreadId, message.gmailThreadId),
      orderBy: asc(emailMessages.receivedAt),
    });

    const [profile, activeProducts, lead] = await Promise.all([
      db.query.businessProfile.findFirst(),
      db.query.products.findMany({ where: eq(products.active, true) }),
      db.query.leads.findFirst({ where: eq(leads.id, leadId) }),
    ]);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const classification = {
      category: (message.aiCategory ?? "relevant") as AiCategory,
      leadType: (lead.leadType ?? "inquiry") as LeadType,
      intent: message.aiReason ?? "",
      confidence: parseFloat(message.aiConfidence ?? "0.5"),
      language: (message.detectedLanguage ?? "en") as LeadLanguage,
      extracted: (lead.aiExtracted as Record<string, unknown>) ?? {},
      reason: message.aiReason ?? "",
    };

    if (typeof classification.extracted.urgency === "string") {
      classification.extracted.urgency = classification.extracted.urgency as Urgency;
    }

    const draftInput = {
      threadHistory: threadMessages.map((m) => ({
        direction: m.direction as "inbound" | "outbound",
        from: m.fromEmail ?? undefined,
        bodyText: m.bodyText ?? "",
        receivedAt: new Date(m.receivedAt),
      })),
      classification,
      businessProfile: {
        companyName: profile?.companyName ?? "White Pops",
        pitchOneLiner: profile?.pitchOneLiner ?? "",
        fssaiNumber: profile?.fssaiNumber ?? undefined,
        gstin: profile?.gstin ?? undefined,
        certifications: profile?.certifications ?? undefined,
        defaultCurrency: profile?.defaultCurrency ?? "INR",
        defaultTone: profile?.defaultTone ?? "warm-professional",
        brandVoice: profile?.brandVoice ?? undefined,
      },
      products: activeProducts.map((p) => ({
        sku: p.sku,
        name: p.name,
        grade: p.grade ?? undefined,
        packSize: p.packSize ?? undefined,
        moq: p.moq ?? undefined,
        priceRetail: p.priceRetail ?? undefined,
        priceWholesale: p.priceWholesale ?? undefined,
        stockNote: p.stockNote ?? undefined,
      })),
      leadMemory: {
        notesForAi: lead.notesForAi ?? undefined,
        contactName: lead.contactName ?? undefined,
        company: lead.company ?? undefined,
        stage: lead.stage ?? undefined,
        leadType: lead.leadType ?? undefined,
      },
      toneExamples: await loadRecentEditExamples({
        limit: 4,
        preferLanguage: classification.language,
      }),
      instructions: instructions || undefined,
    };

    const result = await draft(
      draftInput,
      {
        provider: profile?.drafterProvider ?? "gemini",
        model: profile?.drafterModel ?? "gemini-2.5-flash",
      },
      { leadId },
    );

    const existingDraft = await db.query.aiDrafts.findFirst({
      where: eq(aiDrafts.inReplyToMessageId, inReplyToMessageId),
    });

    let draftId: string;
    if (existingDraft) {
      await db
        .update(aiDrafts)
        .set({
          draftBody: result.body,
          editedBody: null,
          language: result.language,
          status: "pending",
        })
        .where(eq(aiDrafts.id, existingDraft.id));
      draftId = existingDraft.id;
    } else {
      const [record] = await db
        .insert(aiDrafts)
        .values({
          leadId,
          inReplyToMessageId,
          draftBody: result.body,
          language: result.language,
          status: "pending",
        })
        .returning();
      draftId = record.id;
    }

    return NextResponse.json({ draftId, body: result.body });
  } catch (err) {
    if (err instanceof AiCostCapExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "cost_cap_exceeded",
          capInr: err.capInr,
          spentInr: err.spentInr,
        },
        { status: 429 },
      );
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
