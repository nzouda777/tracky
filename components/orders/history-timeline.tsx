import { Badge } from "@/components/ui";
import type { HistoryEntry } from "@/lib/orders/queries";
import { formatDateTime, formatRelative } from "@/lib/utils";

const SOURCE_LABELS: Record<string, { label: string; tone: "info" | "success" | "warning" }> = {
  shopify_webhook: { label: "Shopify", tone: "info" },
  shopify_sync: { label: "Manual sync", tone: "info" },
  agency: { label: "Delivery agency", tone: "success" },
  admin: { label: "Manual override", tone: "warning" },
};

/**
 * The internal event feed for an order.
 *
 * Every row is a real recorded event with its source and, where a person was
 * involved, who they were. Nothing is synthesised for display: if the list is
 * short, that is because nothing else has happened yet.
 */
export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No events recorded yet for this order.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {history.map((entry, index) => {
        const source = SOURCE_LABELS[entry.event.source] ?? {
          label: entry.event.source,
          tone: "info" as const,
        };
        const isLast = index === history.length - 1;

        return (
          <li key={entry.event.id} className="relative flex gap-3 pb-5">
            {!isLast ? (
              <span
                aria-hidden
                className="absolute left-[5px] top-4 h-full w-px bg-ink-200"
              />
            ) : null}

            <span
              aria-hidden
              className="mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: entry.stage?.color ?? "#94a3b8" }}
            />

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink-900">
                  {entry.stage?.name ?? "Unknown stage"}
                </p>
                <Badge tone={source.tone}>{source.label}</Badge>
              </div>

              <p className="text-xs text-ink-500">
                {formatDateTime(entry.event.occurredAt)} ·{" "}
                {formatRelative(entry.event.occurredAt)}
                {entry.actorEmail
                  ? ` · by ${entry.actorName ?? entry.actorEmail}`
                  : ""}
              </p>

              {entry.event.note ? (
                <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  {entry.event.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
