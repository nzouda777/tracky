import Link from "next/link";

import { Badge } from "@/components/ui";
import type { ActivityEntry } from "@/lib/orders/dashboard";
import { formatRelative } from "@/lib/utils";

/**
 * Recent events across the store.
 *
 * These rows are `order_stage_history` verbatim — the same records that build a
 * customer's public timeline. The source is always shown, because "who moved
 * this order" is the question an owner actually has, and because the app's
 * whole premise is that every step came from a real event.
 */
const SOURCE: Record<
  ActivityEntry["source"],
  { label: string; tone: "info" | "success" | "warning" }
> = {
  shopify_webhook: { label: "Shopify", tone: "info" },
  shopify_sync: { label: "Synced", tone: "info" },
  agency: { label: "Agency", tone: "success" },
  admin: { label: "Manual", tone: "warning" },
};

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No events recorded yet. They appear here as soon as Shopify sends an
        order or the agency records an update.
      </p>
    );
  }

  return (
    <ol className="-my-1">
      {entries.map((entry) => {
        const source = SOURCE[entry.source];

        return (
          <li key={entry.id} className="relative flex gap-3 py-2.5">
            <span
              aria-hidden
              className="mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: entry.stageColor ?? "#94a3b8" }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Link
                  href={`/admin/orders/${entry.orderId}`}
                  className="text-sm font-medium text-ink-900 underline-offset-2 hover:underline"
                >
                  {entry.orderNumber}
                </Link>
                <span className="text-sm text-ink-600">
                  → {entry.stageName ?? "unknown stage"}
                </span>
                <Badge tone={source.tone}>{source.label}</Badge>
              </div>

              <p className="mt-0.5 text-xs text-ink-500">
                <time dateTime={entry.occurredAt.toISOString()}>
                  {formatRelative(entry.occurredAt)}
                </time>
                {entry.actor ? `, ${entry.actor}` : ""}
              </p>

              {entry.note ? (
                <p className="mt-1 line-clamp-2 text-xs text-ink-600">
                  “{entry.note}”
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
