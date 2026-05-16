import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function nextLeadCode(): Promise<string> {
  const result = await db.execute<{ max_num: number }>(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(lead_code, 6) AS INTEGER)), 0) + 1 AS max_num FROM "lead"`,
  );
  const nextNum = (result.rows?.[0] as { max_num?: number })?.max_num ?? 1;
  return `LEAD-${String(nextNum).padStart(4, "0")}`;
}

export async function nextCustomerCode(): Promise<string> {
  const result = await db.execute<{ max_num: number }>(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code, 6) AS INTEGER)), 0) + 1 AS max_num FROM "customers"`,
  );
  const nextNum = (result.rows?.[0] as { max_num?: number })?.max_num ?? 1;
  return `CUST-${String(nextNum).padStart(4, "0")}`;
}
