import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rows = await db
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt));

  return <CustomersClient customers={rows} />;
}
