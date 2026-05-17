import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  withWordmark = true,
  className,
  logoUrl,
}: {
  withWordmark?: boolean;
  className?: string;
  logoUrl?: string | null;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative size-9 rounded-full overflow-hidden bg-[oklch(0.18_0.008_80)] grid place-items-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            fill
            sizes="36px"
            className="object-cover"
            priority
          />
        ) : (
          <span className="serif italic text-[oklch(0.96_0.008_80)] text-[21px] leading-none -tracking-[0.5px] pointer-events-none">
            w
          </span>
        )}
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
