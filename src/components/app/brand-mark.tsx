"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * White Pops logomark. Uses /public/logo.png if present, otherwise a serif "w"
 * on a dark chip so the brand still reads cleanly during dev.
 */
export function BrandMark({
  withWordmark = true,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative size-9 rounded-[10px] overflow-hidden bg-[oklch(0.18_0.008_80)] grid place-items-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
        <Image
          src="/logo.png"
          alt="White Pops"
          fill
          sizes="36px"
          className="object-cover"
          priority
          // If logo.png is missing, the fallback "w" below shows through.
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span
          className="serif italic text-[oklch(0.96_0.008_80)] text-[21px] leading-none -tracking-[0.5px] pointer-events-none"
          aria-hidden
        >
          w
        </span>
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-[16px] font-semibold -tracking-[0.01em]">
            White Pops
          </div>
          <div className="text-[11.5px] font-medium tracking-[0.10em] uppercase text-muted-foreground mt-px">
            Saathi Prime
          </div>
        </div>
      )}
    </div>
  );
}
