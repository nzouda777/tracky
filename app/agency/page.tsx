import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AgencyOrderCard } from "@/components/agency/order-card";
import { AgencyFilters } from "@/components/agency/filters";
import { requireAgency } from "@/lib/auth/session";
import { stages } from "@/lib/db";
import { listDriverNames, listOrders } from "@/lib/orders/queries";

export const metadata: Metadata = { title: "Active deliveries" };

/**
 * Dispatch home: every order that still needs doing, newest first.
 * Mobile-first — cards, big tap targets, no horizontal scrolling.
 */
export default async function AgencyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; driver?: string; page?: string }>;
}) {
  const { tdb } = await requireAgency();
  const params = await searchParams;

  const allStages = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });
  const drivers = await listDriverNames(tdb);

  const { rows, total } = await listOrders(tdb, {
    search: params.q,
    stageId: params.stage,
    driver: params.driver,
    onlyActive: true,
    perPage: 50,
    page: Number(params.page ?? 1) || 1,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Active deliveries"
        description={`${total} order${total === 1 ? "" : "s"} still in progress.`}
      />

      <AgencyFilters stages={allStages} drivers={drivers} basePath="/agency" />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing to deliver right now"
            description="Orders appear here as soon as they arrive from Shopify. Adjust the filters if you expected to see something."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ order, stage, hasProof }) => (
            <li key={order.id}>
              <AgencyOrderCard order={order} stage={stage} hasProof={hasProof} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
