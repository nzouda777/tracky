import Link from "next/link";

import { Card } from "@/components/ui";
import type { Stage } from "@/lib/db";
import { STAGE_PHASES, phaseOf } from "@/lib/stages/defaults";

/**
 * Where every order is right now: one tile per progress-bar phase, then every
 * stage of the sequence with the number of orders sitting on it.
 *
 * Each count links to the orders list filtered to that phase or stage, so the
 * overview doubles as the quickest way to open "everything at customs" or
 * "every failed delivery attempt". Counts are of current stages only — an
 * order is in exactly one place.
 */
export function PipelineOverview({
  buckets,
  activePhase,
  activeStageId,
}: {
  buckets: Array<{ stage: Stage; total: number }>;
  activePhase?: string;
  activeStageId?: string;
}) {
  if (buckets.length === 0) return null;

  const phaseTotals = STAGE_PHASES.map((phase) => ({
    ...phase,
    total: buckets
      .filter((bucket) => phaseOf(bucket.stage) === phase.id)
      .reduce((sum, bucket) => sum + bucket.total, 0),
  }));

  return (
    <Card className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phaseTotals.map((phase, index) => {
          const active = activePhase === phase.id;
          return (
            <Link
              key={phase.id}
              href={active ? "/admin/orders" : `/admin/orders?phase=${phase.id}`}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                active
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 hover:bg-ink-50"
              }`}
            >
              <span
                className={`block text-xs font-medium ${
                  active ? "text-ink-200" : "text-ink-500"
                }`}
              >
                {index + 1}. {phase.label}
              </span>
              <span className="mt-0.5 block text-2xl font-semibold tabular-nums">
                {phase.total}
              </span>
            </Link>
          );
        })}
      </div>

      <details open={Boolean(activeStageId || activePhase)}>
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          Orders at each of the {buckets.length} steps
        </summary>

        <div className="mt-3 space-y-4">
          {STAGE_PHASES.map((phase) => {
            const inPhase = buckets
              .map((bucket, index) => ({ ...bucket, step: index + 1 }))
              .filter((bucket) => phaseOf(bucket.stage) === phase.id);
            if (inPhase.length === 0) return null;

            return (
              <div key={phase.id}>
                <p className="text-xs font-semibold text-ink-500">
                  {phase.label}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {inPhase.map(({ stage, total, step }) => {
                    const active = activeStageId === stage.id;
                    return (
                      <li key={stage.id}>
                        <Link
                          href={
                            active
                              ? "/admin/orders"
                              : `/admin/orders?stage=${stage.id}`
                          }
                          title={stage.description}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            active
                              ? "border-ink-900 bg-ink-900 text-white"
                              : total > 0
                                ? "border-ink-300 text-ink-800 hover:bg-ink-50"
                                : "border-ink-100 text-ink-400 hover:bg-ink-50"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="tabular-nums opacity-70">{step}.</span>
                          {stage.name}
                          <span className="font-semibold tabular-nums">
                            {total}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </Card>
  );
}
