import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { aiCalls, emailMessages, leads } from "@/db/schema";
import { PIPELINE_STAGES, normalizeStage } from "@/lib/pipeline-stages";

const RANGE_OPTIONS = ["24h", "7d", "14d", "30d", "QTD"] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number];

function resolveRange(raw: string | null): {
  key: RangeKey;
  days: number;
  since: Date;
} {
  const key: RangeKey = (RANGE_OPTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as RangeKey)
    : "14d";
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  let days: number;
  switch (key) {
    case "24h":
      days = 1;
      break;
    case "7d":
      days = 7;
      since.setDate(since.getDate() - 6);
      break;
    case "30d":
      days = 30;
      since.setDate(since.getDate() - 29);
      break;
    case "QTD": {
      const now = new Date();
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      since.setMonth(qStartMonth, 1);
      days = Math.max(1, Math.floor((Date.now() - since.getTime()) / 86_400_000) + 1);
      break;
    }
    case "14d":
    default:
      days = 14;
      since.setDate(since.getDate() - 13);
      break;
  }
  return { key, days, since };
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = resolveRange(req.nextUrl.searchParams.get("range"));

  const [inboundDailyRows, outboundDailyRows, aiDailyRows, stageRows] =
    await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.direction, "inbound"),
            gte(emailMessages.receivedAt, range.since),
          ),
        )
        .groupBy(sql`date_trunc('day', ${emailMessages.receivedAt})`),

      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.direction, "outbound"),
            gte(emailMessages.receivedAt, range.since),
          ),
        )
        .groupBy(sql`date_trunc('day', ${emailMessages.receivedAt})`),

      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiCalls.createdAt}), 'YYYY-MM-DD')`,
          calls: sql<number>`count(*)`.mapWith(Number),
          costInr: sql<string>`coalesce(sum(${aiCalls.costInr}) filter (where ${aiCalls.status} = 'ok'), 0)`,
        })
        .from(aiCalls)
        .where(gte(aiCalls.createdAt, range.since))
        .groupBy(sql`date_trunc('day', ${aiCalls.createdAt})`),

      db
        .select({
          stage: leads.stage,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(leads)
        .where(isNull(leads.deletedAt))
        .groupBy(leads.stage),
    ]);

  const inboundMap = new Map(inboundDailyRows.map((r) => [r.day, r.count]));
  const outboundMap = new Map(outboundDailyRows.map((r) => [r.day, r.count]));
  const aiCallsMap = new Map(aiDailyRows.map((r) => [r.day, r.calls]));
  const aiCostMap = new Map(aiDailyRows.map((r) => [r.day, parseFloat(r.costInr)]));

  // Stage totals collapsed onto the canonical pipeline ids.
  const stageTotals: Record<string, number> = {};
  for (const r of stageRows) {
    const key = normalizeStage(r.stage);
    stageTotals[key] = (stageTotals[key] ?? 0) + r.count;
  }

  const lines: string[] = [];
  lines.push(`# Reports export · range=${range.key} · since=${range.since.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("# Daily activity");
  lines.push(csvRow(["date", "inbound", "outbound", "ai_calls", "ai_cost_inr"]));
  for (let i = 0; i < range.days; i++) {
    const d = new Date(range.since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    lines.push(
      csvRow([
        key,
        inboundMap.get(key) ?? 0,
        outboundMap.get(key) ?? 0,
        aiCallsMap.get(key) ?? 0,
        (aiCostMap.get(key) ?? 0).toFixed(4),
      ]),
    );
  }

  lines.push("");
  lines.push("# Pipeline funnel (cumulative — leads at stage or downstream)");
  lines.push(csvRow(["stage", "label", "count"]));
  const pipelineIds = PIPELINE_STAGES.map((s) => s.id);
  PIPELINE_STAGES.forEach((s, i) => {
    const value = pipelineIds.slice(i).reduce(
      (sum, id) => sum + (stageTotals[id] ?? 0),
      0,
    );
    lines.push(csvRow([s.id, s.label, value]));
  });

  const body = lines.join("\n") + "\n";
  const filename = `reports-${range.key}-${range.since.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
