import { StageIcon } from "@/components/tracking/stage-icon";

/**
 * A still of the customer tracking page, for the landing hero.
 *
 * It is drawn with the same shapes, spacing and states the real page uses —
 * filled badges for what has happened, a haloed badge for the current step, a
 * faint connector into what has not — so the picture on the marketing site is
 * not making a promise the product does not keep.
 *
 * The order on it is openly an example: the caption underneath says so, and
 * the numbers are obviously round. Better that than a screenshot of somebody's
 * real delivery.
 */
const STEPS = [
  { label: "Order Placed", icon: "receipt", state: "done" },
  { label: "Confirmed", icon: "check", state: "done" },
  { label: "Processing", icon: "package", state: "done" },
  { label: "Out for Delivery", icon: "truck", state: "current" },
  { label: "Delivered", icon: "home", state: "upcoming" },
] as const;

export function TrackingPreview() {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        {/* Browser chrome, so it reads as a page rather than a diagram. */}
        <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            {["#e2e8f0", "#e2e8f0", "#e2e8f0"].map((colour, index) => (
              <span
                key={index}
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colour }}
              />
            ))}
          </span>
          <span className="ml-1 truncate rounded-md bg-white px-2 py-1 text-[11px] text-ink-500 ring-1 ring-inset ring-ink-200">
            yourstore.com/apps/track-order
          </span>
        </div>

        <div className="px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink-900">Sarah Jenkins</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Order
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink-900">#1042</p>
            </div>
          </div>

          {/* The stepper, in the real page's states. */}
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
                    <span
                      aria-hidden
                      className="h-[3px] flex-1"
                      style={{
                        backgroundColor:
                          index === 0
                            ? "transparent"
                            : reached
                              ? "var(--color-ink-900)"
                              : "var(--color-ink-200)",
                      }}
                    />
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full border-2"
                      style={
                        reached
                          ? {
                              backgroundColor: "var(--color-ink-900)",
                              borderColor: "var(--color-ink-900)",
                              color: "#ffffff",
                              boxShadow:
                                step.state === "current"
                                  ? "0 0 0 4px rgba(15,23,42,0.14)"
                                  : undefined,
                            }
                          : {
                              backgroundColor: "var(--color-ink-50)",
                              borderColor: "var(--color-ink-200)",
                              color: "var(--color-ink-400)",
                            }
                      }
                    >
                      <StageIcon
                        name={step.state === "done" ? "check" : step.icon}
                        className="size-4"
                      />
                    </span>
                    <span
                      aria-hidden
                      className="h-[3px] flex-1"
                      style={{
                        backgroundColor:
                          index === STEPS.length - 1
                            ? "transparent"
                            : nextReached
                              ? "var(--color-ink-900)"
                              : "var(--color-ink-200)",
                      }}
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

          <div className="mt-6 overflow-hidden rounded-xl border border-ink-200">
            <p className="bg-ink-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-600">
              Latest update
            </p>
            <div className="px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink-900">
                  Out for Delivery
                </p>
                <span className="shrink-0 text-[10px] text-ink-400">
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
      </div>

      <figcaption className="mt-3 text-center text-xs text-ink-500">
        The customer tracking page, styled from your branding. Example order.
      </figcaption>
    </figure>
  );
}
