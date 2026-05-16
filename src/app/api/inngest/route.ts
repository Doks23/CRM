import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { gmailPoll } from "@/inngest/functions/gmail-poll";
import { aiClassify } from "@/inngest/functions/ai-classify";
import { aiDraftFn } from "@/inngest/functions/ai-draft";
import { followUpTick } from "@/inngest/functions/follow-up";
import { seasonalOutreach } from "@/inngest/functions/seasonal-outreach";
import { repeatOrderRadar } from "@/inngest/functions/repeat-order-radar";
import { sampleFollowup } from "@/inngest/functions/sample-followup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    gmailPoll,
    aiClassify,
    aiDraftFn,
    followUpTick,
    seasonalOutreach,
    repeatOrderRadar,
    sampleFollowup,
  ],
});
