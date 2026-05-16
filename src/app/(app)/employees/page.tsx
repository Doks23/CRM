import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { EmployeeManager } from "./employee-manager";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const allUsers = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.createdAt)] });

  return (
    <EmployeeManager
      users={allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
