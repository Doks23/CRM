import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div className="p-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="outline" className="text-xs font-normal">
            {milestone}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>

        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Not built yet</CardTitle>
            <CardDescription>
              The screen is fully specified in{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">
                docs/PRD.md
              </code>
              . Implementation lands in {milestone}.
            </CardDescription>
          </CardHeader>
          {bullets && bullets.length > 0 ? (
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-primary mt-0.5">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
