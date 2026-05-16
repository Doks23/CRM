import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Editorial placeholder for screens not yet built. Keeps the visual language
 * consistent with the rest of the redesign while pages catch up.
 */
export function Placeholder({
  title,
  description,
  milestone,
  bullets,
}: {
  title: string;
  description: string;
  milestone: string;
  bullets?: string[];
}) {
  return (
    <div className="p-8 lg:p-10">
      <div className="max-w-3xl">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="serif text-[30px] leading-tight -tracking-[0.015em]">
            {title}
          </h1>
          <Badge variant="outline" className="font-normal">
            {milestone}
          </Badge>
        </div>
        <p className="text-[13.5px] text-muted-foreground mb-6">
          {description}
        </p>

        <Card className="p-6 gap-3 bg-surface-2 border-dashed">
          <div className="font-heading text-[14px] font-semibold">
            Not built yet
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-[1.55]">
            The screen is fully specified in{" "}
            <code className="px-1 py-0.5 rounded bg-card text-[11px] font-mono">
              docs/PRD.md
            </code>
            . Implementation lands in {milestone}.
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="text-[12.5px] text-muted-foreground space-y-1.5">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-primary mt-0.5">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
