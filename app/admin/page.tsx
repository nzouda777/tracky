import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AttentionPanel } from "@/components/admin/attention-panel";
import { StageFunnel } from "@/components/admin/stage-funnel";
import { StatTile } from "@/components/admin/stat-tile";
import { StageBadge } from "@/components/orders/stage-badge";
import { IconExternal } from "@/components/icons";
import { requireOwner } from "@/lib/auth/session";
import {
  getAttentionItems,
  getDailyOrderVolume,
  getDashboardMetrics,
  getDriverWorkload,
  getOrderedStages,
  getRecentActivity,
  getStageDistribution,
} from "@/lib/orders/dashboard";
import { listOrders } from "@/lib/orders/queries";
import { buildTrackingLookupLink } from "@/lib/tracking/links";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The operations dashboard.
 *
 * Ordered by what the owner needs first: what is broken, then what is moving,
 * then the detail. Every number traces to a recorded fact — orders mirrored
 * from Shopify, events in `order_stage_history`, proofs of delivery — so the
 * dashboard can never claim progress the customer's timeline does not show.
 */
export default async function AdminDashboardPage() {
  const { tdb, store } = await requireOwner();

  const allStages = await getOrderedStages(tdb);

  const [metrics, distribution, volume, attention, activity, drivers, recent] =
    await Promise.all([
      getDashboardMetrics(tdb, allStages),
      getStageDistribution(tdb, allStages),
      getDailyOrderVolume(tdb, 14),
      getAttentionItems(tdb, allStages),
      getRecentActivity(tdb, 10),
      getDriverWorkload(tdb, allStages),
      listOrders(tdb, { perPage: 6, onlyActive: true }),
    ]);

  const deliveryRate =
    metrics.totalOrders === 0
      ? null
      : Math.round((metrics.fulfilled / metrics.totalOrders) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.name ?? store.shopDomain}
        description="Post-purchase tracking and last-mile delivery for this store."
        action={
          <a
            href={buildTrackingLookupLink(store)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
          >
            Customer tracking page
            <IconExternal className="size-3.5" />
          </a>
        }
      />

      {/* ---------------- KPI row ---------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Orders in progress"
          value={metrics.activeOrders}
          hint={`${metrics.totalOrders} synced in total`}
          href="/admin/orders?status=active"
          emphasis
        />
        <StatTile
          label="Delivered, last 7 days"
          value={metrics.deliveredLast7}
          delta={{
            current: metrics.deliveredLast7,
            previous: metrics.deliveredPrevious7,
            periodLabel: "in the 7 days before",
          }}
          hint="Counted from confirmed deliveries"
        />
        <StatTile
          label="Awaiting delivery confirmation"
          value={metrics.awaitingConfirmation}
          hint="The agency has not recorded a proof of delivery"
          href="/admin/orders?status=active"
        />
        <StatTile
          label="New orders"
          value={volume.reduce((sum, point) => sum + point.total, 0)}
          hint="Last 14 days"
          trend={volume}
        />
      </div>

      {/* ---------------- Attention + pipeline ---------------- */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader
            title="Needs attention"
            description="Problems that stop orders progressing or customers being told."
          />
          <CardBody>
            <AttentionPanel items={attention} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Delivery pipeline"
            description="Open orders per stage. Select one to filter the order list."
            action={
              <Link
                href="/admin/stages"
                className="text-xs font-medium text-ink-600 underline underline-offset-2"
              >
                Edit stages
              </Link>
            }
          />
          <CardBody>
            <StageFunnel
              buckets={distribution.buckets}
              noStage={distribution.noStage}
            />
          </CardBody>
        </Card>
      </div>

      {/* ---------------- Activity + side column ---------------- */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader
            title="Recent activity"
            description="Every stage change, with who recorded it."
            action={
              <Link
                href="/admin/orders"
                className="text-xs font-medium text-ink-600 underline underline-offset-2"
              >
                All orders
              </Link>
            }
          />
          <CardBody>
            <ActivityFeed entries={activity} />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Active deliveries"
              description="Oldest first is the agency's view; this is the latest."
              action={
                <Link
                  href="/agency"
                  className="text-xs font-medium text-ink-600 underline underline-offset-2"
                >
                  Dispatch
                </Link>
              }
            />
            <CardBody>
              {recent.rows.length === 0 ? (
                <p className="text-sm text-ink-500">
                  Nothing in progress right now.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100 -my-2">
                  {recent.rows.map(({ order, stage }) => (
                    <li
                      key={order.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="block truncate text-sm font-medium text-ink-900 underline-offset-2 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="truncate text-xs text-ink-500">
                          {order.customerName ?? "No name"} ·{" "}
                          {order.assignedDriverName ?? "no driver"}
                        </p>
                      </div>
                      <StageBadge stage={stage} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Driver workload"
              description="Open deliveries per driver label."
            />
            <CardBody>
              {drivers.length === 0 ? (
                <p className="text-sm text-ink-500">
                  No drivers assigned to open orders.
                  {metrics.unassigned > 0
                    ? ` ${metrics.unassigned} order${metrics.unassigned === 1 ? "" : "s"} waiting to be assigned.`
                    : ""}
                </p>
              ) : (
                <ul className="space-y-2">
                  {drivers.map((entry) => (
                    <li
                      key={entry.driver}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-ink-700">
                        {entry.driver}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                        {entry.active}
                      </span>
                    </li>
                  ))}
                  {metrics.unassigned > 0 ? (
                    <li className="flex items-center justify-between gap-3 border-t border-ink-100 pt-2 text-sm">
                      <span className="text-ink-500">Unassigned</span>
                      <span className="font-semibold tabular-nums text-ink-700">
                        {metrics.unassigned}
                      </span>
                    </li>
                  ) : null}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Store health" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <Row
                  label="Fulfilled in Shopify"
                  value={
                    deliveryRate === null
                      ? "—"
                      : `${metrics.fulfilled} of ${metrics.totalOrders} (${deliveryRate}%)`
                  }
                />
                <Row
                  label="Orders without an email"
                  value={
                    metrics.withoutEmail === 0
                      ? "None"
                      : `${metrics.withoutEmail} — cannot be notified`
                  }
                />
                <Row
                  label="Connected since"
                  value={
                    store.installedAt ? formatDate(store.installedAt) : "—"
                  }
                />
                <Row
                  label="Last sync"
                  value={
                    recent.rows[0]
                      ? formatRelative(recent.rows[0].order.updatedAt)
                      : activity[0]
                        ? formatRelative(activity[0].occurredAt)
                        : "No activity yet"
                  }
                />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}
