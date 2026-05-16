import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { emailMessages, leads } from "@/db/schema";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { CreateLeadButton } from "@/components/pipeline/create-lead-button";
import { Providers } from "@/components/providers";

const INACTIVE_STAGES = new Set(["ignored"]);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.active) redirect("/login?error=deactivated");

  const initial =
    (session.user.name ?? session.user.email ?? "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  // Sidebar badge counts — cheap aggregates, run in parallel.
  const [inboxRow, stageRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct gmail_thread_id)`.mapWith(Number) })
      .from(emailMessages)
      .where(
        sql`(
          select m2.direction from email_message m2
          where m2.gmail_thread_id = ${emailMessages.gmailThreadId}
          order by m2.received_at desc limit 1
        ) = 'inbound'
        and (
          select m2.ai_category from email_message m2
          where m2.gmail_thread_id = ${emailMessages.gmailThreadId}
          order by m2.received_at desc limit 1
        ) not in ('spam', 'newsletter')`,
      ),
    db
      .select({ stage: leads.stage, count: sql<number>`count(*)`.mapWith(Number) })
      .from(leads)
      .groupBy(leads.stage),
  ]);

  const inboxCount = inboxRow[0]?.n ?? 0;
  const pipelineCount = stageRows
    .filter((r) => !INACTIVE_STAGES.has(r.stage))
    .reduce((s, r) => s + r.count, 0);

  return (
    <Providers>
    <div className="flex min-h-screen bg-background">
      <Sidebar
        userInitial={initial}
        userName={session.user.name ?? session.user.email ?? "User"}
        userEmail={session.user.email ?? ""}
        userRole={session.user.role ?? "Owner"}
        inboxCount={inboxCount}
        pipelineCount={pipelineCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar newButton={<CreateLeadButton />} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
    </Providers>
  );
}
