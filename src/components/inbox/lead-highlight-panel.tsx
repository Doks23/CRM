import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WhatsAppButton } from "./whatsapp-button";
import { StageSelect } from "./stage-select";

interface HighlightField {
  label: string;
  value: React.ReactNode;
}

interface Props {
  leadId: string;
  contactName: string | null;
  company: string | null;
  primaryEmail: string;
  phone: string | null;
  stage: string | null;
  leadType: string | null;
  score: number | null;
  source: string | null;
  language: "en" | "hi" | "hinglish" | null;
  companyNameForWhatsApp: string;
  /** Optional right-side primary action (e.g. record-level CTA). */
  primaryAction?: React.ReactNode;
}

/**
 * Lead record highlight panel — Salesforce Lightning Experience pattern.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ← Inbox    Contact name                          [WhatsApp] │
 *   │            Company · email · phone                          │
 *   │ ───────────────────────────────────────────────────────────  │
 *   │ Stage · Type · Score · Source · Language                    │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Header + meta strip below. Mobile-friendly: stat row wraps; the back
 * button + actions row stays at top.
 */
export function LeadHighlightPanel({
  leadId,
  contactName,
  company,
  primaryEmail,
  phone,
  stage,
  leadType,
  score,
  source,
  language,
  companyNameForWhatsApp,
  primaryAction,
}: Props) {
  const displayName = contactName ?? primaryEmail;

  const fields: HighlightField[] = [
    { label: "Stage", value: <StageSelect leadId={leadId} currentStage={stage} /> },
    {
      label: "Type",
      value: leadType && leadType !== "n/a" ? (
        <span className="capitalize">{leadType.replace(/_/g, " ")}</span>
      ) : (
        <Muted />
      ),
    },
    {
      label: "Score",
      value: typeof score === "number" ? (
        <span className="tabular-nums font-medium">{score}</span>
      ) : (
        <Muted />
      ),
    },
    {
      label: "Source",
      value: source && source !== "unknown" ? (
        <span className="capitalize">{source.replace(/_/g, " ")}</span>
      ) : (
        <Muted />
      ),
    },
    {
      label: "Language",
      value: language ? (
        <span className="uppercase tracking-wider text-[11px] font-medium">
          {language}
        </span>
      ) : (
        <Muted />
      ),
    },
  ];

  return (
    <div className="border-b bg-card">
      {/* Top row: back, identity, actions */}
      <div className="px-6 pt-4 pb-3 flex items-start gap-4">
        <Link
          href="/inbox"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "shrink-0 -ml-2",
          )}
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate">{displayName}</h1>
          <div className="text-meta mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
            {company ? (
              <>
                <span className="text-foreground/80 font-medium">
                  {company}
                </span>
                <span className="text-foreground/30">·</span>
              </>
            ) : null}
            <span>{primaryEmail}</span>
            {phone ? (
              <>
                <span className="text-foreground/30">·</span>
                <span>{phone}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {primaryAction}
          <WhatsAppButton
            leadId={leadId}
            phone={phone}
            contactName={contactName}
            companyName={companyNameForWhatsApp}
            language={language}
          />
        </div>
      </div>

      {/* Meta strip — Salesforce Lightning record highlights */}
      <div className="px-6 pb-3 pt-1 border-t border-border/60 flex flex-wrap items-center gap-x-6 gap-y-2 -mt-1">
        {fields.map((f) => (
          <div key={f.label} className="flex flex-col">
            <span className="text-eyebrow">{f.label}</span>
            <span className="text-[13px] mt-0.5 leading-none">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Muted() {
  return <span className="text-muted-foreground">—</span>;
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <Muted />;
  const label = stage.replace(/_/g, " ");
  const style = stageStyle(stage);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] py-0 h-5 px-1.5 capitalize border",
        style,
      )}
    >
      {label}
    </Badge>
  );
}

function stageStyle(stage: string): string {
  switch (stage) {
    case "won":
      return "bg-success/10 text-success border-success/25";
    case "lost":
      return "bg-destructive/10 text-destructive border-destructive/25";
    case "po_received":
    case "dispatched":
      return "bg-info/10 text-info border-info/25";
    case "negotiation":
    case "info_sent":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "nurture":
      return "bg-muted text-muted-foreground border-foreground/15";
    default:
      return "bg-muted text-foreground/80 border-foreground/15";
  }
}
