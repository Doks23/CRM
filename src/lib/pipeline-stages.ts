/**
 * Canonical pipeline stage order — single source of truth for the
 * Pipeline board, the Reports funnel, and any other view that needs the
 * stage sequence. Keep this list aligned with the UI ordering on
 * /pipeline; everything downstream is derived.
 */
export const PIPELINE_STAGES = [
  { id: "new",         label: "New",         color: "var(--stage-1)" },
  { id: "info_sent",   label: "Info Sent",   color: "var(--stage-4)" },
  { id: "negotiation", label: "Negotiation", color: "var(--stage-5)" },
  { id: "po",          label: "PO",          color: "var(--stage-6)" },
  { id: "dispatched",  label: "Dispatched",  color: "var(--stage-2)" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

/**
 * Map legacy stage values still present in the DB enum to the current
 * pipeline ids. Used wherever we aggregate by stage so old rows don't
 * silently disappear from totals.
 */
export const STAGE_ALIAS: Record<string, PipelineStageId | "ignored"> = {
  po_received: "po",
  won: "dispatched",
  lost: "ignored",
  qualified: "info_sent",
  needs_review: "new",
  nurture: "ignored",
};

export function normalizeStage(stage: string): string {
  return STAGE_ALIAS[stage] ?? stage;
}
