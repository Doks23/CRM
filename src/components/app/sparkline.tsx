/**
 * Compact area/line sparkline. SVG only, no chart lib. Defaults to the primary
 * accent — pass `color` (a CSS color, including `var(--…)`) for variants.
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--primary)",
  strokeWidth = 1.6,
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
}) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const pts = data.map<[number, number]>((v, i) => [
    i * step,
    height - 4 - ((v - min) / range) * (height - 8),
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  const last = pts[pts.length - 1];
  const gid = `spk-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} className="block overflow-visible">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={5} fill={color} opacity={0.15} />
    </svg>
  );
}
