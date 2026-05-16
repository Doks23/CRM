import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Templated page header used across every screen.
 *
 * Lightning Experience / Zoho pattern:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Eyebrow (optional)                                   │
 *   │ Title             Meta-row · count · subtitle  Actions│
 *   ├──────────────────────────────────────────────────────┤
 *   │ Optional toolbar slot (filters, view switcher)        │
 *   └──────────────────────────────────────────────────────┘
 *
 * Keep all five default page headers tight and consistent — the visual
 * difference between pages should come from their body content, not from
 * header chrome.
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  /** "Inbox · 12 unread" style line under the title. */
  subtitle?: React.ReactNode;
  /** Tiny uppercase eyebrow above the title (e.g. section name). */
  eyebrow?: React.ReactNode;
  /** Right-aligned action buttons. Pass the primary CTA last for keyboard order. */
  actions?: React.ReactNode;
  /** Status chips next to the title (stage, connection state, etc.). */
  badges?: React.ReactNode;
  /** Bottom toolbar — filters, view-switcher, tabs. Sits below the divider. */
  toolbar?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  badges,
  toolbar,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "border-b bg-card",
        className,
      )}
    >
      <div className="px-6 pt-4 pb-3 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="text-eyebrow mb-1">{eyebrow}</div>
          ) : null}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-foreground">{title}</h1>
            {badges ? (
              <div className="flex items-center gap-1.5">{badges}</div>
            ) : null}
          </div>
          {subtitle ? (
            <div className="text-meta mt-0.5 truncate">{subtitle}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="px-6 pb-2.5 -mt-1 flex items-center gap-3 overflow-x-auto">
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Small companion: a stat-style label/value pair for the meta row.
 * Use sparingly — too many of these turn the header into a dashboard.
 */
export function PageStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-1 mr-3">
      <span className="text-eyebrow">{label}</span>
      <span className="text-meta tabular-nums">{value}</span>
    </span>
  );
}
