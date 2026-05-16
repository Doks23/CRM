import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Renders the White Pops logo from /public/logo.png plus an optional wordmark.
 * If logo.png is missing, the Image will 404 silently — drop the file at
 * /public/logo.png to make it appear.
 */
export function BrandMark({
  size = 36,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative shrink-0 rounded-full overflow-hidden bg-zinc-950"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt="White Pops"
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority
        />
      </div>
      {withWordmark ? (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">White Pops</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            CRM
          </div>
        </div>
      ) : null}
    </div>
  );
}
