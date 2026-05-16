import { db } from "@/db";
import { leads, customers } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function nextLeadCode(): Promise<string> {
  const last = await db
    .select({ code: leads.leadCode })
    .from(leads)
    .orderBy(desc(leads.leadCode))
    .limit(1)
    .then((r) => r[0] ?? null);

  let nextNum = 1;
  if (last) {
    const match = last.code.match(/LEAD-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `LEAD-${String(nextNum).padStart(4, "0")}`;
}

export async function nextCustomerCode(): Promise<string> {
  const last = await db
    .select({ code: customers.customerCode })
    .from(customers)
    .orderBy(desc(customers.customerCode))
    .limit(1)
    .then((r) => r[0] ?? null);

  let nextNum = 1;
  if (last) {
    const match = last.code.match(/CUST-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `CUST-${String(nextNum).padStart(4, "0")}`;
}
