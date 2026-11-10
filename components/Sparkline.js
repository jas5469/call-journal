// A tiny price line chart, drawn as SVG. No chart library needed.
import { money } from "@/lib/format";

export default function Sparkline({ points, height = 120, currency }) {
  if (!points?.length) return null;
  const w = 600;
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const x = (i) => (i / (points.length - 1)) * w;
  const y = (v) => height - 8 - ((v - min) / span) * (height - 16);
  const d = closes.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = closes.at(-1) >= closes[0];
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
        aria-label={`Closing prices ${points[0].date} to ${points.at(-1).date}`}>
        <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity="0.08" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>{points[0].date}</span>
        <span>low {money(min, 2, currency)} · high {money(max, 2, currency)}</span>
        <span>{points.at(-1).date}</span>
      </div>
    </div>
  );
}
