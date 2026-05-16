import { cn } from "@/lib/utils";

const PALETTE: Array<[string, string]> = [
  ["oklch(0.30 0.05 150)", "oklch(0.48 0.11 162)"], // forest
  ["oklch(0.30 0.07 70)", "oklch(0.55 0.15 70)"],   // amber
  ["oklch(0.28 0.10 280)", "oklch(0.50 0.18 285)"], // indigo
  ["oklch(0.30 0.10 25)", "oklch(0.55 0.18 25)"],   // terracotta
  ["oklch(0.28 0.08 240)", "oklch(0.50 0.15 250)"], // ocean
  ["oklch(0.30 0.06 60)", "oklch(0.50 0.10 60)"],   // bronze
  ["oklch(0.28 0.10 310)", "oklch(0.50 0.16 310)"], // violet
  ["oklch(0.28 0.08 180)", "oklch(0.48 0.12 175)"], // teal
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

const SIZE_CLASSES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[12px]",
  lg: "size-11 text-[14px]",
  xl: "size-16 text-[22px]",
} as const;

export type SmartAvatarSize = keyof typeof SIZE_CLASSES;

/**
 * Deterministic, warm-gradient avatar built from a name. Renders a square or
 * circle with 1–2 initials and a stable gradient seeded by the name.
 */
export function SmartAvatar({
  name,
  size = "md",
  square = false,
  className,
}: {
  name: string;
  size?: SmartAvatarSize;
  square?: boolean;
  className?: string;
}) {
  const [a, b] = PALETTE[hash(name) % PALETTE.length];
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-semibold text-white shrink-0",
        SIZE_CLASSES[size],
        square ? "rounded-lg" : "rounded-full",
        className
      )}
      style={{ backgroundImage: `linear-gradient(140deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </div>
  );
}

/** Logo chip — first letter of a company name in a small gradient square. */
export function CompanyLogo({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [a, b] = PALETTE[hash(name || "x") % PALETTE.length];
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center text-white font-medium shrink-0 rounded-lg",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(140deg, ${a}, ${b})`,
        fontFamily: "var(--font-display), serif",
        fontStyle: "italic",
        fontSize: size * 0.42,
        letterSpacing: "-0.02em",
      }}
    >
      {(name || "?")[0]?.toUpperCase()}
    </div>
  );
}
