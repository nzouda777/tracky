import Link from "next/link";

import type { StageBucket } from "@/lib/orders/dashboard";

/**
 * Orders per stage, as horizontal bars.
 *
 * Form: the reader's job is comparing magnitude across an ordered set of
 * categories, which is a bar chart with **one hue** — a colour per stage would
 * encode identity the label already carries, and would break past ~6 stages
 * where an ordinal ramp can no longer keep visible lightness gaps.
 *
 * The stage's own configured colour still appears as a small dot beside its
 * name, matching `StageBadge` everywhere else in the app: the coloured mark
 * beside the text carries identity, the bar carries the value.
 *
 * Bars are 10px thick with a 4px rounded data-end, square at the baseline, and
 * every value is directly labelled — so nothing depends on reading a bar
 * length precisely, and the panel needs no axis or gridlines.
 */
export function StageFunnel({
  buckets,
  noStage,
}: {
  buckets: StageBucket[];
  noStage: number;
}) {
  if (buckets.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No stages configured yet, so there is no pipeline to show.
      </p>
    );
  }

  const total = buckets.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="space-y-3">
      <ol className="space-y-2.5">
        {buckets.map((bucket) => {
          const pct = total === 0 ? 0 : Math.round((bucket.total / total) * 100);

          return (
            <li key={bucket.stage.id}>
              <Link
                href={`/admin/orders?stage=${bucket.stage.id}`}
                className="group block rounded-lg px-1 py-0.5 -mx-1 transition-colors hover:bg-ink-50"
                title={`${bucket.total} order${bucket.total === 1 ? "" : "s"} in ${bucket.stage.name}${
                  total > 0 ? ` — ${pct}% of the pipeline` : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: bucket.stage.color }}
                    />
                    <span className="truncate text-sm text-ink-700 group-hover:text-ink-900">
                      {bucket.stage.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                    {bucket.total}
                  </span>
                </div>

                {/* Track is a lighter step of the bar's own ramp, so an empty
                    stage still reads as a stage rather than blank space. */}
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-sm bg-ink-100">
                  <div
                    className="h-full rounded-r-[4px]"
                    style={{
                      width: `${Math.max(bucket.share * 100, bucket.total > 0 ? 3 : 0)}%`,
                      backgroundColor: "var(--viz-series-1)",
                    }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      {noStage > 0 ? (
        <p className="border-t border-ink-100 pt-2.5 text-xs text-ink-500">
          {noStage} order{noStage === 1 ? "" : "s"} not in any stage — usually a
          stage that was deleted while orders were still in it.
        </p>
      ) : null}
    </div>
  );
}
