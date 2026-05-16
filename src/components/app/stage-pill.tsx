import { cn } from "@/lib/utils";

const STAGE_COLOR_VAR: Record<string, string> = {
  new: "var(--stage-1)",
  ignored: "var(--stage-8)",
  "info sent": "var(--stage-4)",
  negotiation: "var(--stage-5)",
  po: "var(--stage-6)",
  dispatched: "var(--stage-2)",
};

export function StagePill({
  label,
  className,
  dotSize = 7,
}: {
  label: string;
  className?: string;
  dotSize?: number;
}) {
  const color =
    STAGE_COLOR_VAR[label.toLowerCase()] ?? "var(--muted-foreground)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] font-medium text-foreground/75",
        className
      )}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: dotSize, height: dotSize, background: color }}
      />
      {label}
    </span>
  );
}

export function StageDot({
  stage,
  size = 8,
  className,
}: {
  stage: string;
  size?: number;
  className?: string;
}) {
  const color =
    STAGE_COLOR_VAR[stage.toLowerCase()] ?? "var(--muted-foreground)";
  return (
    <span
      className={cn("inline-block rounded-full shrink-0", className)}
      style={{ width: size, height: size, background: color }}
    />
  );
}
