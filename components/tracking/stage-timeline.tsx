import type { TimelineEntry } from "@/lib/orders/stages";
import { StageIcon } from "./stage-icon";

/**
 * The horizontal stage stepper.
 *
 * Each stage is a badge carrying the icon the admin chose for it, joined by a
 * connector that is solid up to the current stage and faint beyond it — so the
 * shape of the journey reads before any of the words do.
 *
 * Three states, and the difference is never colour alone:
 *   complete  — filled, tick glyph
 *   current   — filled, plus a halo ring, a bold label and a "Current step" tag
 *   upcoming  — hollow, faint border, muted label
 *
 * **One hue, deliberately.** Stages each carry an admin-chosen colour, and
 * painting the badges with them turns a progress bar into a rainbow whose
 * connectors change hue mid-line — colour then encodes identity, which the
 * label already carries, instead of encoding progress, which is the only
 * question this control answers. The per-stage colours still do their job in
 * the backoffice, where telling stages apart at a glance is the point.
 *
 * Nothing is ever shown as reached unless a real recorded event put the order
 * there. An order sitting at stage one shows one filled badge, however long it
 * has been sitting.
 */
export function StageTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-1">
      <ol className="flex items-start">
        {timeline.map((entry, index) => {
          const { stage, state } = entry;
          const isFirst = index === 0;
          const isLast = index === timeline.length - 1;

          // A segment is filled only when the badge it *arrives at* has been
          // reached. Keying it off the badge behind instead would draw a solid
          // line into the next, unreached stage — which reads as "this has
          // happened" for something that has not.
          const leftLive = state !== "upcoming";
          const rightLive = !isLast && timeline[index + 1].state !== "upcoming";

          return (
            <li
              key={stage.id}
              aria-current={state === "current" ? "step" : undefined}
              className="flex min-w-24 flex-1 flex-col items-center text-center"
            >
              <div className="flex w-full items-center">
                <Connector live={leftLive} hidden={isFirst} />

                <span
                  className="relative grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={
                    state === "upcoming"
                      ? {
                          backgroundColor: "var(--brand-surface)",
                          borderColor: "var(--brand-border)",
                          color: "var(--brand-muted)",
                        }
                      : {
                          backgroundColor: "var(--brand-primary)",
                          borderColor: "var(--brand-primary)",
                          color: "var(--brand-background)",
                          // The halo marks the current step without reaching
                          // for a second hue.
                          boxShadow:
                            state === "current"
                              ? "0 0 0 4px color-mix(in srgb, var(--brand-primary) 20%, transparent)"
                              : undefined,
                        }
                  }
                >
                  {state === "complete" ? (
                    <StageIcon name="check" className="size-5" />
                  ) : (
                    <StageIcon name={stage.icon} className="size-5" />
                  )}
                </span>

                <Connector live={rightLive} hidden={isLast} />
              </div>

              <p
                className="mt-2.5 px-1 text-[13px] leading-tight"
                style={{
                  color:
                    state === "upcoming"
                      ? "var(--brand-muted)"
                      : "var(--brand-text)",
                  fontWeight: state === "upcoming" ? 500 : 600,
                }}
              >
                {stage.name}
              </p>

              {state === "current" ? (
                <span
                  className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-primary) 12%, var(--brand-background))",
                    color: "var(--brand-primary)",
                  }}
                >
                  Current step
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Connector({ live, hidden }: { live: boolean; hidden: boolean }) {
  return (
    <span
      aria-hidden
      // Square ends: each gap is drawn as two halves, and rounded caps meeting
      // in the middle leave a visible pinch in what should be one line.
      className="h-[3px] flex-1"
      style={{
        backgroundColor: hidden
          ? "transparent"
          : live
            ? "var(--brand-primary)"
            : "var(--brand-border)",
      }}
    />
  );
}
