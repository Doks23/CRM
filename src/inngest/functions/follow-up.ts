import { eq, sql, and, inArray, isNull, desc } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/db";
import { leads, emailMessages, aiDrafts } from "@/db/schema";

export const followUpTick = inngest.createFunction(
  {
    id: "follow-up-tick",
    name: "Check for leads needing follow-up",
    concurrency: { limit: 1 },
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step, logger }) => {
    const profile = await step.run("load-profile", async () => {
      return db.query.businessProfile.findFirst();
    });

    const infoSentDays = profile?.followUpInfoSentDays ?? 4;
    const negotiationDays = profile?.followUpNegotiationDays ?? 3;

    const staleLeads = await step.run("find-stale", async () => {
      const infoCutoff = new Date(Date.now() - infoSentDays * 86_400_000);
      const negotCutoff = new Date(Date.now() - negotiationDays * 86_400_000);

      return db.query.leads.findMany({
        where: and(
          isNull(leads.deletedAt),
          inArray(leads.stage, ["info_sent", "negotiation"]),
          sql`(${leads.stage} = 'info_sent' AND ${leads.lastActivityAt} < ${infoCutoff})
               OR (${leads.stage} = 'negotiation' AND ${leads.lastActivityAt} < ${negotCutoff})`,
        ),
      });
    });

    for (const lead of staleLeads) {
      await step.run(`check-lead-${lead.id}`, async () => {
        const recentInbound = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.leadId, lead.id),
            eq(emailMessages.direction, "inbound"),
            sql`${emailMessages.receivedAt} > ${lead.lastActivityAt}`,
          ),
        });

        if (!recentInbound) {
          const existingDraft = await db.query.aiDrafts.findFirst({
            where: and(
              eq(aiDrafts.leadId, lead.id),
              eq(aiDrafts.status, "pending"),
              sql`${aiDrafts.createdAt} > ${new Date(Date.now() - 86_400_000)}`,
            ),
          });

          if (existingDraft) return;

          // Anchor the follow-up draft to the latest OUTBOUND message in this
          // lead's thread. Without this, the draft is orphaned and the
          // thread-detail UI never renders it.
          const latestOutbound = await db.query.emailMessages.findFirst({
            where: and(
              eq(emailMessages.leadId, lead.id),
              eq(emailMessages.direction, "outbound"),
            ),
            orderBy: [desc(emailMessages.receivedAt)],
          });

          if (!latestOutbound) {
            // Nothing we sent → nothing to follow up on. Skip silently.
            logger.info("follow-up skipped: no outbound message", {
              leadId: lead.id,
            });
            return;
          }

          await db.insert(aiDrafts).values({
            leadId: lead.id,
            inReplyToMessageId: latestOutbound.id,
            draftBody: `[Auto-generated] Follow-up needed — last activity was ${daysAgo(new Date(lead.lastActivityAt))} days ago.`,
            status: "pending",
          });
          logger.info("follow-up draft created", {
            leadId: lead.id,
            anchorMessageId: latestOutbound.id,
          });
        }
      });
    }

    return { checked: staleLeads.length };
  },
);

function daysAgo(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
