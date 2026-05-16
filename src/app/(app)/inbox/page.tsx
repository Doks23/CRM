import { Placeholder } from "@/components/app/placeholder";

export default function InboxPage() {
  return (
    <Placeholder
      title="Inbox"
      description="AI-triaged emails from the shared Gmail account, ready for review."
      milestone="Milestones 2–3"
      bullets={[
        "Two-pane layout: lead list left, thread + AI draft right",
        "Filters by AI category, lead type, assignee, language",
        "Approve & Send pushes the existing Gmail Draft via the Gmail API",
      ]}
    />
  );
}
