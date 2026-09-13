import Link from "next/link";

import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCheckCircle,
  IconClock,
  IconInfo,
} from "@/components/icons";
import type { AttentionItem, Severity } from "@/lib/orders/dashboard";

/**
 * The "what needs doing" panel.
 *
 * Status colours are fixed and two of them sit below 3:1 on a white surface by
 * design, so every row pairs its colour with an **icon and a text label**. The
 * colour is never the only channel.
 */
const SEVERITY: Record<
  Severity,
  { label: string; icon: typeof IconAlertOctagon; color: string; ring: string }
> = {
  critical: {
    label: "Critical",
    icon: IconAlertOctagon,
    color: "var(--viz-critical)",
    ring: "border-red-200 bg-red-50/60",
  },
  serious: {
    label: "Serious",
    icon: IconAlertTriangle,
    color: "var(--viz-serious)",
    ring: "border-orange-200 bg-orange-50/60",
  },
  warning: {
    label: "Warning",
    icon: IconClock,
    color: "var(--viz-warning)",
    ring: "border-amber-200 bg-amber-50/60",
  },
  info: {
    label: "For information",
    icon: IconInfo,
    color: "var(--viz-series-1)",
    ring: "border-blue-200 bg-blue-50/60",
  },
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
        <span style={{ color: "var(--viz-good)" }}>
          <IconCheckCircle className="mt-0.5 size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink-900">
            All clear — nothing needs attention
          </p>
          <p className="mt-0.5 text-xs text-ink-600">
            No failed fulfillments, no failed emails, and no orders sitting
            without an update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const severity = SEVERITY[item.severity];
        const Icon = severity.icon;

        return (
          <li
            key={item.id}
            className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${severity.ring}`}
          >
            <span style={{ color: severity.color }} className="mt-0.5 shrink-0">
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-ink-900">{item.title}</p>
                {/* The severity is spelled out, so colour is never load-bearing. */}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {severity.label}
                </span>
                {item.count !== undefined ? (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-700 ring-1 ring-inset ring-ink-200">
                    {item.count}
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-xs text-ink-600">{item.detail}</p>

              {item.href ? (
                <Link
                  href={item.href}
                  className="mt-1.5 inline-block text-xs font-semibold text-ink-800 underline underline-offset-2 hover:text-ink-900"
                >
                  {item.linkLabel ?? "Open"} →
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
