import type { TimelineEntry } from "@/lib/orders/stages";

/**
 * The progress bar at the top of an order: the four phases of the journey
 * (Order Placed → Processing → In Transit → Delivered), each a round icon on
 * a shared track, with the track filled up to the phase the order is in.
 *
 *   done      solid disc in the text colour, white glyph
 *   active    the same disc at half strength
 *   pending   pale disc, muted glyph
 *
 * The bar is fed the phase timeline (`buildPhaseTimeline`), not the store's
 * full stage list — that can run to dozens of steps, which the event history
 * below lists one by one. Nothing is drawn as reached unless a recorded stage
 * put the order there.
 *
 * Everything is styled inline rather than with utility classes, so the bar
 * renders identically on our own domain and embedded in a Shopify theme,
 * where only the scoped embed sheet is available.
 */
export function RouteLine({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) return null;

  const count = timeline.length;
  const inset = 50 / count;
  const currentIndex = timeline.findIndex((entry) => entry.state === "current");
  const lastReached =
    currentIndex >= 0
      ? currentIndex
      : timeline.filter((entry) => entry.state === "complete").length - 1;
  const fill =
    count > 1 && lastReached > 0
      ? (lastReached / (count - 1)) * (100 - inset * 2)
      : 0;

  return (
    <div data-part="route" style={{ position: "relative" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 18,
          left: `${inset}%`,
          right: `${inset}%`,
          height: 2,
          borderRadius: 999,
          backgroundColor: "var(--brand-line)",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 18,
          left: `${inset}%`,
          width: `${fill}%`,
          height: 2,
          borderRadius: 999,
          background:
            "linear-gradient(to right, var(--brand-text), color-mix(in srgb, var(--brand-text) 50%, var(--brand-surface)))",
        }}
      />

      <ol
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {timeline.map((entry) => {
          const { stage, state } = entry;
          const delivered = state === "current" && stage.isTerminal;
          const tone: Tone =
            state === "complete" || delivered
              ? "done"
              : state === "current"
                ? "active"
                : "pending";

          return (
            <li
              key={stage.id}
              aria-current={state === "current" ? "step" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                width: `${100 / count}%`,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: TONE_BG[tone],
                  color:
                    tone === "pending"
                      ? "var(--brand-muted)"
                      : "var(--brand-surface)",
                }}
              >
                <PhaseGlyph icon={stage.icon} />
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  textAlign: "center",
                  color: TONE_LABEL[tone],
                }}
              >
                {stage.name}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type Tone = "done" | "active" | "pending";

const TONE_BG: Record<Tone, string> = {
  done: "var(--brand-text)",
  active: "color-mix(in srgb, var(--brand-text) 50%, var(--brand-surface))",
  pending: "var(--brand-line)",
};

const TONE_LABEL: Record<Tone, string> = {
  done: "var(--brand-text)",
  active: "color-mix(in srgb, var(--brand-text) 50%, var(--brand-surface))",
  pending: "var(--brand-muted)",
};

/** 16px glyphs on a 16 grid, drawn in `currentColor`. */
function PhaseGlyph({ icon }: { icon: string }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {icon === "receipt" ? (
        <>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" {...common} />
          <path d="M5 3.5V2.5M11 3.5V2.5M2.5 6.5h11" {...common} />
        </>
      ) : icon === "package" ? (
        <path
          d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5"
          {...common}
        />
      ) : icon === "truck" ? (
        <>
          <path d="M2 5.5h8v5.5H2zM10 7l3 1.5V11h-3V7z" {...common} />
          <circle cx="4.5" cy="11.5" r="1" {...common} strokeWidth={1.2} />
          <circle cx="11.5" cy="11.5" r="1" {...common} strokeWidth={1.2} />
        </>
      ) : (
        <path d="M3 8l3.5 3.5L13 4.5" {...common} strokeWidth={1.6} />
      )}
    </svg>
  );
}
