import Link from "next/link";

import { AIProvidersForm } from "@/components/settings/ai-providers-form";
import { getBusinessProfile } from "@/lib/business-profile";
import { getAiCostCapStatus } from "@/lib/ai";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsAIPage() {
  const profile = await getBusinessProfile();
  const cap = await getAiCostCapStatus();
  const capPct = cap.unlimited
    ? 0
    : Math.min(100, Math.round((cap.spentInr / Math.max(cap.capInr, 0.01)) * 100));

  return (
    <div className="space-y-5">
      <header>
        <h1>AI providers</h1>
        <p className="text-meta">
          Pick the model that classifies incoming email and the model that drafts
          replies. They can run on different providers.
        </p>
      </header>

      <AIProvidersForm
        initial={{
          classifierProvider: profile.classifierProvider,
          classifierModel: profile.classifierModel,
          drafterProvider: profile.drafterProvider,
          drafterModel: profile.drafterModel,
        }}
      />

      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-[14px] font-semibold">Today's AI spend</h3>
        </div>
        <div className="p-4 space-y-3">
          {cap.unlimited ? (
            <p className="text-meta">
              No cap set. Set <code className="font-mono text-foreground">dailyAiCostCapInr</code> in
              the database to enforce a daily limit.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-eyebrow">Spent today</span>
                <span className="text-[14px] tabular-nums">
                  ₹{cap.spentInr.toFixed(2)} / ₹{cap.capInr.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    capPct >= 100
                      ? "bg-destructive"
                      : capPct >= 80
                        ? "bg-warning"
                        : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, capPct)}%` }}
                />
              </div>
              <p className="text-meta">
                See <Link href="/reports" className="underline">Reports</Link> for
                per-call breakdown.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
