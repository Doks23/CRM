import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sampleDispatches, leads } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { SamplesList } from "@/components/samples/samples-list";

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

  const allLeads = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      primaryEmail: leads.primaryEmail,
    })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .orderBy(leads.contactName);

  const serialized = rows.map((r) => ({
    ...r,
    sentAt: r.sentAt?.toISOString() ?? null,
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    followUpDueAt: r.followUpDueAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return <SamplesList initial={serialized} leads={allLeads} />;
}
