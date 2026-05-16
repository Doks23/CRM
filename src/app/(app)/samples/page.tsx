import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sampleDispatches, leads, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rows = await db
    .select({
      id: sampleDispatches.id,
      sku: sampleDispatches.sku,
      quantityNote: sampleDispatches.quantityNote,
      status: sampleDispatches.status,
      courier: sampleDispatches.courier,
      awb: sampleDispatches.awb,
      sentAt: sampleDispatches.sentAt,
      deliveredAt: sampleDispatches.deliveredAt,
      followUpDueAt: sampleDispatches.followUpDueAt,
      note: sampleDispatches.note,
      createdAt: sampleDispatches.createdAt,
      leadName: leads.contactName,
      leadEmail: leads.primaryEmail,
      leadId: leads.id,
    })
    .from(sampleDispatches)
    .leftJoin(leads, eq(leads.id, sampleDispatches.leadId))
    .orderBy(desc(sampleDispatches.createdAt));

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-[26px] serif leading-tight">Samples</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">
          {rows.length} sample{rows.length !== 1 ? "s" : ""} dispatched
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-[15px] font-medium">No samples dispatched yet</p>
            <p className="text-[13px] mt-1">Samples will appear here once dispatched from a lead thread.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {rows.map((s) => (
              <div key={s.id} className="rounded-lg border px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium">{s.sku}</span>
                    <span className={`text-[11px] px-1.5 py-px rounded-full font-medium capitalize ${
                      s.status === "delivered" ? "bg-pos-tint text-pos" :
                      s.status === "in_transit" ? "bg-info-tint text-info" :
                      s.status === "closed" ? "bg-muted text-muted-foreground" :
                      "bg-warning-tint text-warning"
                    }`}>
                      {s.status?.replace(/_/g, " ") ?? "pending"}
                    </span>
                  </div>
                  {s.leadName && (
                    <Link href={`/inbox/${s.leadId}`} className="text-[13px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                      {s.leadName}{s.leadEmail ? ` · ${s.leadEmail}` : ""}
                    </Link>
                  )}
                  <div className="text-[12px] text-muted-foreground mt-1 flex gap-3 flex-wrap">
                    {s.quantityNote && <span>Qty: {s.quantityNote}</span>}
                    {s.courier && <span>{s.courier}{s.awb ? `: ${s.awb}` : ""}</span>}
                    {s.sentAt && <span>Sent {new Date(s.sentAt).toLocaleDateString()}</span>}
                    {s.deliveredAt && <span>Delivered {new Date(s.deliveredAt).toLocaleDateString()}</span>}
                    {s.followUpDueAt && <span>Follow-up due {new Date(s.followUpDueAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
