import type { StageIcon as StageIconName } from "@/lib/stages/defaults";

/**
 * The glyphs an admin can pick for a stage.
 *
 * These are drawn at 20px inside a 44px badge on the customer timeline, so
 * they are deliberately simple: a 1.9 stroke on a 24 grid survives that size
 * and still reads on a phone. They inherit `currentColor` so the badge decides
 * the colour.
 *
 * The keys must stay in step with `STAGE_ICONS` in lib/stages/defaults.ts —
 * that list is what the stage editor offers, and an unknown name falls back to
 * a plain dot rather than rendering nothing.
 */
const PATHS: Record<StageIconName, React.ReactNode> = {
  circle: <circle cx="12" cy="12" r="4.5" />,

  receipt: (
    <>
      <path d="M6.5 3.5h11v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.3 1.4-2.2-1.4z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </>
  ),

  check: <path d="m5.5 12.5 4 4 9-9" />,

  package: (
    <>
      <path d="M12 3.2 20 7.4v9.2L12 20.8 4 16.6V7.4z" />
      <path d="M4 7.4 12 11.6l8-4.2M12 11.6v9.2" />
    </>
  ),

  truck: (
    <>
      <path d="M2.8 6.5h10.4v9.2H2.8zM13.2 9.8h3.6l2.9 3.2v2.7h-6.5" />
      <circle cx="6.6" cy="17.6" r="1.7" />
      <circle cx="16.6" cy="17.6" r="1.7" />
    </>
  ),

  home: (
    <>
      <path d="M4 10.4 12 4l8 6.4V20H4z" />
      <path d="M9.6 20v-5.6h4.8V20" />
    </>
  ),

  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.4V12l3 1.9" />
    </>
  ),

  warehouse: (
    <>
      <path d="M3 9.6 12 5.2l9 4.4V20H3z" />
      <path d="M7.6 20v-6.4h8.8V20M7.6 16.4h8.8" />
    </>
  ),

  "map-pin": (
    <>
      <path d="M12 21s6.4-5.6 6.4-10.2A6.4 6.4 0 0 0 5.6 10.8C5.6 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.6" r="2.3" />
    </>
  ),

  alert: (
    <>
      <path d="M12 4.4 2.9 20h18.2z" />
      <path d="M12 10.2v4.3M12 17.4h.01" />
    </>
  ),
};

export function StageIcon({
  name,
  className = "size-5",
}: {
  name: string;
  className?: string;
}) {
  const glyph = PATHS[name as StageIconName] ?? PATHS.circle;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
