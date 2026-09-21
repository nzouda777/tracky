import type { TimelineEntry } from "@/lib/orders/stages";

/**
 * The route line — the signature device of the interface.
 *
 * This is not a generic dotted progress bar. It is a route: waypoints joined
 * by the road between them, the way a run sheet reads. The road behind the
 * order is drawn; the road ahead is dotted, because it has not happened yet.
 *
 * Horizontal on a wide screen, vertical on a phone — one list, not two, so the
 * reading order and the markup stay identical for a screen reader.
 *
 * Four waypoint states, and none of them is distinguished by colour alone:
 *   passed     filled disc
 *   active     filled disc inside a hi-vis amber ring, pulsing slowly
 *   upcoming   hollow ring, dotted road in
 *   delivered  green disc with a tick, and only on the terminal waypoint
 *
 * The pulse is the single un-triggered animation in the whole product: it
 * marks what is moving right now. It stops under `prefers-reduced-motion`,
 * where the amber ring alone carries the state.
 *
 * Nothing is ever drawn as reached unless a real recorded event put the order
 * there. An order sitting at waypoint one shows one filled disc, however long
 * it has been sitting.
 */
export function RouteLine({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <ol className="flex flex-col sm:flex-row sm:items-start">
      {timeline.map((entry, index) => {
        const { stage, state } = entry;
        const isFirst = index === 0;
        const isLast = index === timeline.length - 1;
        const delivered = state === "current" && stage.isTerminal;

        // A segment is drawn as travelled only when the waypoint it *arrives
        // at* has been reached. Keying it off the waypoint behind would draw a
        // solid road into a stage that has not happened.
        const roadIn = state !== "upcoming";
        const roadOut = !isLast && timeline[index + 1].state !== "upcoming";

        return (
          <li
            key={stage.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex gap-3.5 sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-0"
          >
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <Road live={roadIn} invisible={isFirst} lead />

              <Waypoint state={state} delivered={delivered} />

              <Road live={roadOut} invisible={isLast} />
            </div>

            {/*
              The space below a step is a margin here, and on the label rather
              than on the step, for two reasons that both had to be found by
              measuring.

              `last:` matches `:last-child`, and this block is always the last
              child of its own step — so a `last:pb-0` here quietly cancelled
              the spacing on *every* step, which is why the rail read as a
              cramped list. And padding on the step would not work either: a
              stretched flex child only spans the content box, so the rail
              would stop short and leave a gap before the next waypoint. A
              margin grows the flex line itself, and the rail follows it.
            */}
            <div
              className={`min-w-0 sm:mt-2.5 sm:px-1 sm:text-center ${
                isLast ? "" : "mb-9 sm:mb-0"
              }`}
            >
              <p
                className="text-small"
                style={{
                  color:
                    state === "upcoming"
                      ? "var(--brand-muted)"
                      : "var(--brand-text)",
                  fontWeight: state === "upcoming" ? 400 : 600,
                }}
              >
                {stage.name}
              </p>
              {state === "current" ? (
                <p
                  className="text-caption"
                  style={{ color: "var(--brand-muted)" }}
                >
                  {delivered ? "Completed" : "In progress"}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The road between two waypoints.
 *
 * One element serves both orientations: a left border makes the vertical rail
 * on a phone, a top border the horizontal line on a wide screen.
 *
 * `lead` is the half that arrives at the waypoint, and it is why this takes a
 * prop at all. On a wide screen both halves grow, which is what centres the
 * waypoint in its cell. On a phone the same rule centred the waypoint in a row
 * whose height is set by the label beside it — so a step carrying a second
 * line ("In progress") pushed its own marker 11px below the word it marks, and
 * every step after it inherited the drift. The arriving half is therefore
 * fixed on a phone and only the departing half grows, which pins each marker
 * to the first line of its label.
 */
function Road({
  live,
  invisible,
  lead,
}: {
  live: boolean;
  invisible: boolean;
  lead?: boolean;
}) {
  // Half a line of text above the marker's own half: together they put the
  // marker's centre on the label's first baseline box.
  const vertical = lead ? "h-px shrink-0" : "min-h-3 flex-1";

  // An invisible road still has to hold the horizontal layout together — it is
  // the half-segment that keeps the first and last waypoints centred in their
  // cells — but on the vertical rail it must collapse, or the first waypoint
  // floats away from the top of the list.
  if (invisible) {
    return (
      <span
        aria-hidden
        className={`w-0 shrink-0 sm:h-0 sm:w-auto sm:flex-1 sm:border-t-2 sm:border-transparent ${lead ? "" : "flex-1"}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`w-0 border-l-2 sm:h-0 sm:min-h-0 sm:w-auto sm:flex-1 sm:border-l-0 sm:border-t-2 ${vertical}`}
      style={{
        borderColor: live ? "var(--brand-text)" : "var(--brand-line)",
        borderStyle: live ? "solid" : "dotted",
      }}
    />
  );
}

/**
 * Every waypoint occupies the same 20px box whatever state it is in.
 *
 * The active one is visually larger because of its ring, and if that ring set
 * the footprint the vertical rail would step sideways at the waypoint the
 * order is at — the one place the eye is going. So the box is fixed and the
 * marks are centred inside it.
 */
function Waypoint({
  state,
  delivered,
}: {
  state: TimelineEntry["state"];
  delivered: boolean;
}) {
  return (
    <span className="relative grid size-5 shrink-0 place-items-center">
      {state === "current" && !delivered ? (
        // The hi-vis ring, and the one thing on the page that moves by itself.
        // The disc underneath carries the state on its own when motion is off.
        <span
          aria-hidden
          className="waypoint-pulse absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--brand-signal)" }}
        />
      ) : null}

      {delivered ? (
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full"
          style={{ backgroundColor: "var(--brand-delivered)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--brand-surface)"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
          >
            <path d="m5.5 12.5 4 4 9-9" />
          </svg>
        </span>
      ) : state === "upcoming" ? (
        <span
          aria-hidden
          className="size-3.5 rounded-full border-2"
          style={{ borderColor: "var(--brand-line)" }}
        />
      ) : (
        <span
          aria-hidden
          className="size-3.5 rounded-full"
          style={{ backgroundColor: "var(--brand-text)" }}
        />
      )}
    </span>
  );
}
