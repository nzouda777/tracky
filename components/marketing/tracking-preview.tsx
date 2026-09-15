/**
 * A still of the customer tracking page, for the landing hero.
 *
 * It is drawn with the same shapes, spacing and states the real page uses —
 * the travelled road solid, the road ahead dotted, a hi-vis ring on the
 * waypoint the order is actually at — so the picture on the marketing site is
 * not making a promise the product does not keep.
 *
 * The order on it is openly an example: the caption underneath says so, and
 * the numbers are obviously round. Better that than a screenshot of somebody's
 * real delivery.
 */
const STEPS = [
  { label: "Order Placed", state: "done" },
  { label: "Confirmed", state: "done" },
  { label: "Processing", state: "done" },
  { label: "Out for Delivery", state: "current" },
  { label: "Delivered", state: "upcoming" },
] as const;

export function TrackingPreview() {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-panel border border-line bg-white">
        {/* Browser chrome, so it reads as a page rather than a diagram. */}
        <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="size-2.5 rounded-full bg-ink-200"
              />
            ))}
          </span>
          <span className="ml-1 truncate rounded-control bg-white px-2 py-1 text-[11px] text-ink-500 ring-1 ring-inset ring-line">
            yourstore.com/apps/track-order
          </span>
        </div>

        <div className="px-5 py-6">
          <h3 className="type-display text-h3">
            Order <span className="type-code">#1042</span>
          </h3>
          <p className="mt-1.5 text-xs text-ink-500">Sarah Jenkins</p>

          {/* The route line, in the real page's states. */}
          <ol className="mt-6 flex items-start">
            {STEPS.map((step, index) => {
              const reached = step.state !== "upcoming";
              const nextReached =
                index < STEPS.length - 1 && STEPS[index + 1].state !== "upcoming";

              return (
                <li
                  key={step.label}
                  className="flex min-w-0 flex-1 flex-col items-center text-center"
                >
                  <div className="flex w-full items-center">
                    <Road live={reached} invisible={index === 0} />

                    {step.state === "current" ? (
                      <span className="relative grid size-4 shrink-0 place-items-center">
                        <span
                          aria-hidden
                          className="waypoint-pulse absolute inset-0 rounded-full border-2 border-signal"
                        />
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full bg-ink-900"
                        />
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className={`size-2.5 shrink-0 rounded-full ${
                          reached ? "bg-ink-900" : "border-2 border-line"
                        }`}
                      />
                    )}

                    <Road
                      live={nextReached}
                      invisible={index === STEPS.length - 1}
                    />
                  </div>
                  <p
                    className={`mt-2 px-0.5 text-[10px] leading-tight ${
                      reached
                        ? "font-semibold text-ink-800"
                        : "font-medium text-ink-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 rounded-panel border border-line px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-ink-900">
                Out for Delivery
              </p>
              <span className="type-code shrink-0 text-[10px] text-ink-500">
                Today, 7:34 am
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              The package is on its way today. Our driver will ask you to sign
              the paper delivery note.
            </p>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-xs text-ink-500">
        The customer tracking page, styled from your branding. Example order.
      </figcaption>
    </figure>
  );
}

function Road({ live, invisible }: { live: boolean; invisible: boolean }) {
  if (invisible) return <span aria-hidden className="h-0 flex-1" />;

  return (
    <span
      aria-hidden
      className={`h-0 flex-1 border-t-2 ${
        live ? "border-solid border-ink-900" : "border-dotted border-line"
      }`}
    />
  );
}
