/** Donut chart — each segment is `{ label, value, color }`. Center can be JSX. */
export function Donut({
  segments,
  size = 120,
  thickness = 14,
  gap = 0.02,
  children,
}: {
  segments: { label?: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  gap?: number;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = -0.25; // start at top

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        {segments.map((s, i) => {
          const frac = s.value / total;
          const a0 = acc * Math.PI * 2 + gap / 2;
          const a1 = (acc + frac) * Math.PI * 2 - gap / 2;
          acc += frac;
          const x0 = c + r * Math.cos(a0);
          const y0 = c + r * Math.sin(a0);
          const x1 = c + r * Math.cos(a1);
          const y1 = c + r * Math.sin(a1);
          const large = frac > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {children}
        </div>
      )}
    </div>
  );
}
