import { Placeholder } from "@/components/app/placeholder";

export default function PipelinePage() {
  return (
    <Placeholder
      title="Pipeline"
      description="Kanban view of every lead by deal stage. Drag to advance the stage."
      milestone="Milestone 4"
      bullets={[
        "Columns: New → Qualified → Info Sent → Negotiation → PO Received → Dispatched → Won / Lost / Nurture",
        "Cards show contact, company, days since last activity, owner avatar",
        "Drop on a column to change stage; activity log records the move",
      ]}
    />
  );
}
