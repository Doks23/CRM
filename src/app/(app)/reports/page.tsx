import { Placeholder } from "@/components/app/placeholder";

export default function ReportsPage() {
  return (
    <Placeholder
      title="Reports"
      description="Inbox health, lead funnel, response performance, per-rep leaderboard, and AI cost."
      milestone="Milestone 5"
      bullets={[
        "Inbox: emails received, breakdown by AI category, language mix",
        "Funnel: counts per stage, conversion rates, average days in stage",
        "Performance: median time-to-draft, time-to-send, draft approve/edit/discard rate",
        "Per-rep leaderboard and daily AI cost in INR",
      ]}
    />
  );
}
