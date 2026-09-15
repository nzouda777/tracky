import Link from "next/link";

import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/lib/orders/dashboard";

/**
 * KPI stat tile: a label, a value, an optional delta and an optional sparkline.
 *
 * A single current number is a stat tile, not a one-bar chart. The value uses
 * the font's proportional figures (never `tabular-nums`, which makes a large
 * standalone number look loose); only columns of numbers get tabular figures.
 */
export function StatTile({
  label,
  value,
  hint,
  delta,
  trend,
  href,
  emphasis,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: { current: number; previous: number; periodLabel: string };
  trend?: DailyPoint[];
  href?: string;
  /** Draws the tile as the leading figure of the view. Use once. */
  emphasis?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {delta ? <Delta {...delta} /> : null}
      </div>

      <p
        className={cn(
          "mt-1.5 font-semibold tracking-tight text-ink-900",
          emphasis ? "text-4xl" : "text-2xl",
        )}
      >
        {typeof value === "number" ? compact(value) : value}
      </p>

      {hint ? <p className="mt-0.5 text-xs text-ink-400">{hint}</p> : null}

      {trend && trend.length > 1 ? (
        <Sparkline points={trend} className="mt-3" />
      ) : null}
    </>
  );

  const shell = cn(
    "block rounded-xl border border-ink-200 bg-white px-4 py-3.5 shadow-sm transition-colors",
    href && "hover:border-ink-300 hover:bg-ink-50",
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * Signed change against a named period.
 *
 * Direction is carried by an arrow glyph and the text itself, so the colour is
 * reinforcement rather than the only channel.
 */
function Delta({
  current,
  previous,
  periodLabel,
}: {
  current: number;
  previous: number;
  periodLabel: string;
}) {
  // With no prior period there is no change to state — saying "+100%" against
  // zero would be an invention.
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const pct = previous === 0 ? null : Math.round((diff / previous) * 100);
  const flat = diff === 0;

  const tone = flat
    ? "text-ink-500"
    : diff > 0
      ? "text-emerald-700"
      : "text-red-700";

  return (
    <span
      className={cn("shrink-0 text-xs font-medium tabular-nums", tone)}
      title={`${current} vs ${previous} ${periodLabel}`}
    >
      {flat ? "—" : diff > 0 ? "↑" : "↓"}{" "}
      {pct === null ? `${diff > 0 ? "+" : ""}${diff}` : `${Math.abs(pct)}%`}
    </span>
  );
}

/**
 * 12–14 point sparkline: de-emphasis fill, accent line, accent end-dot with a
 * 2px surface ring so it stays legible where it meets the axis.
 */
function Sparkline({
  points,
  className,
}: {
  points: DailyPoint[];
  className?: string;
}) {
  const width = 120;
  const height = 28;
  const peak = Math.max(1, ...points.map((p) => p.total));

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - (point.total / peak) * (height - 4) - 2;
    return { x, y, point };
  });

  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} ${width},${height} 0,${height}`;
  const last = coords[coords.length - 1];

  const from = points[0].date;
  const to = points[points.length - 1].date;
  const label = `Orders per day, ${fmt(from)} to ${fmt(to)}. Peak ${peak}.`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-7 w-full", className)}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polygon points={area} fill="var(--viz-series-1-wash)" opacity="0.55" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--viz-series-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r="2.5"
        fill="var(--viz-series-1)"
        stroke="var(--viz-surface)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** 1,284 / 12.9K / 1.4M — auto-compact, per the stat-tile contract. */
function compact(value: number): string {
  if (Math.abs(value) < 1000) return String(value);
  if (Math.abs(value) < 1_000_000) {
    const k = value / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  const m = value / 1_000_000;
  return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
}

function fmt(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(date);
}
