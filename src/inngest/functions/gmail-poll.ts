import { inngest } from "../client";
import { syncGmail } from "@/lib/gmail/sync";
import { db } from "@/db";
import { businessProfile, gmailAccount } from "@/db/schema";

export const gmailPoll = inngest.createFunction(
  {
    id: "gmail-poll",
    name: "Poll Gmail and ingest new messages",
    concurrency: { limit: 1 },
    triggers: [{ cron: "* * * * *" }, { event: "gmail/sync.requested" }],
  },
  async ({ step, logger }) => {
    // Load profile to check sync settings.
    const profile = await step.run("load-profile", async () => {
      return db.query.businessProfile.findFirst();
    });

    // Master toggle — stop all polling during dev.
    if (profile && !profile.gmailSyncEnabled) {
      logger.info("gmail.sync skipped — sync is paused in Settings");
      return { skipped: true, reason: "gmailSyncEnabled is false" };
    }

    // Respect the configured poll interval.
    const intervalMin = profile?.pollIntervalMinutes ?? 2;
    const account = await step.run("load-account", async () => {
      return db.query.gmailAccount.findFirst();
    });
    if (account?.lastPolledAt) {
      const elapsed = (Date.now() - new Date(account.lastPolledAt).getTime()) / 60_000;
      if (elapsed < intervalMin) {
        logger.info("gmail.sync skipped — last poll was %.1f min ago (interval: %d min)", elapsed, intervalMin);
        return { skipped: true, reason: `only ${elapsed.toFixed(1)}m since last poll` };
      }
    }

    const result = await step.run("sync", () => syncGmail());

    logger.info("gmail.sync result", {
      inserted: result.inserted,
      skipped: result.skipped,
      filtered: result.filtered,
      errors: result.errors,
    });
    return result;
  },
);
