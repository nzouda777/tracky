import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { StatTile } from "@/components/admin/stat-tile";
import { AuditTable } from "@/components/platform/audit-table";
import { HealthBadge } from "@/components/platform/health-badge";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { listPlatformAudit } from "@/lib/platform/audit";
import {
  getBusiestStores,
  getPlatformDailyVolume,
} from "@/lib/platform/detail";
import {
  getPlatformActivity,
  getPlatformStores,
  getPlatformTotals,
} from "@/lib/platform/queries";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform overview" };

/** Worst first: a store that cannot import orders outranks one with a warning. */
const SEVERITY_RANK = { broken: 0, attention: 1, healthy: 2 } as const;

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();

  const [totals, storeRows, activity, volume, busiest, audit] =
    await Promise.all([
      getPlatformTotals(),
      getPlatformStores(),
      getPlatformActivity(10),
      getPlatformDailyVolume(14),
      getBusiestStores(5),
      listPlatformAudit({ limit: 6 }),
    ]);

  const needsAttention = storeRows
    .filter((row) => row.health !== "healthy")
    .sort((a, b) => SEVERITY_RANK[a.health] - SEVERITY_RANK[b.health]);

  const suspended = storeRows.filter((row) => row.store.suspendedAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Every connected store, in one view."
        action={
          <Link
            href="/platform/audit"
            className="text-sm font-medium text-ink-600 underline underline-offset-2"
          >
            Audit log →
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Connected stores"
          value={totals.activeStores}
          hint={
            [
              totals.uninstalledStores > 0
                ? `${totals.uninstalledStores} uninstalled`
                : null,
              suspended > 0 ? `${suspended} suspended` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "All healthy"
          }
          href="/platform/stores"
          emphasis
        />
        <StatTile
          label="Orders, last 7 days"
          value={totals.ordersLast7}
          delta={{
            current: totals.ordersLast7,
            previous: totals.ordersPrevious7,
            periodLabel: "in the 7 days before",
          }}
          hint={`${totals.orders} across all time`}
          trend={volume}
        />
        <StatTile
          label="Deliveries confirmed"
          value={totals.deliveriesLast7}
          hint="Last 7 days, from proof of delivery"
        />
        <StatTile
          label="Accounts"
          value={totals.users}
          hint="Owners, agency users and operators"
          href="/platform/users"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Stores needing attention"
            description="Anything not in a healthy state, worst first."
            action={
              <Link
                href="/platform/stores"
                className="text-xs font-medium text-ink-600 underline underline-offset-2"
              >
                All stores
              </Link>
            }
          />
          <CardBody>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-ink-500">
                Every connected store is healthy — stages configured, no failed
                fulfillments, no failed email, none suspended.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 -my-2.5">
                {needsAttention.map((row) => (
                  <li
                    key={row.store.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/platform/stores/${row.store.id}`}
                        className="block truncate text-sm font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {row.store.name ?? row.store.shopDomain}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {row.healthReason}
                      </p>
                    </div>
                    <HealthBadge health={row.health} reason={row.healthReason} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Platform issues" />
          <CardBody>
            <dl className="space-y-2.5 text-sm">
              <Row
                label="Fulfillments rejected by Shopify"
                value={totals.failedFulfillments}
                href="/platform/stores"
              />
              <Row
                label="Emails failed to send"
                value={totals.failedEmails}
                href="/platform/health"
              />
              <Row
                label="Emails waiting to send"
                value={totals.scheduledEmails}
                neutral
              />
              <Row
                label="Webhooks errored, last 7 days"
                value={totals.unprocessedWebhooks}
                href="/platform/health"
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Busiest stores"
            description="Orders in the last 7 days."
          />
          <CardBody>
            {busiest.length === 0 ? (
              <p className="text-sm text-ink-500">No stores yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {busiest.map((entry) => (
                  <li key={entry.store.id}>
                    <Link
                      href={`/platform/stores/${entry.store.id}`}
                      className="group block rounded-lg -mx-1 px-1 py-0.5 hover:bg-ink-50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-ink-700 group-hover:text-ink-900">
                          {entry.store.name ?? entry.store.shopDomain}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                          {entry.orders}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-sm bg-ink-100">
                        <div
                          className="h-full rounded-r-[4px]"
                          style={{
                            width: `${Math.max(entry.share * 100, entry.orders > 0 ? 3 : 0)}%`,
                            backgroundColor: "var(--viz-series-1)",
                          }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Activity across all stores"
            description="The most recent stage events anywhere."
          />
          <CardBody>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-500">No events recorded yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100 -my-2">
                {activity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {entry.storeName}
                    </span>
                    <span className="text-sm text-ink-600">
                      {entry.orderNumber} → {entry.stageName ?? "unknown"}
                    </span>
                    <Badge tone="neutral">
                      {entry.source.replace(/_/g, " ")}
                    </Badge>
                    <span className="ml-auto text-xs text-ink-400">
                      {formatRelative(entry.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent operator actions"
          description="Every change an operator made across tenants."
          action={
            <Link
              href="/platform/audit"
              className="text-xs font-medium text-ink-600 underline underline-offset-2"
            >
              Full log
            </Link>
          }
        />
        <AuditTable entries={audit} />
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  href,
  neutral,
}: {
  label: string;
  value: number;
  href?: string;
  neutral?: boolean;
}) {
  const tone = neutral || value === 0 ? "text-ink-900" : "text-red-700";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500">
        {href && value > 0 ? (
          <Link href={href} className="underline underline-offset-2">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={`font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
