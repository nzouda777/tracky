import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AgencyOrderCard } from "@/components/agency/order-card";
import { AgencyFilters } from "@/components/agency/filters";
import { requireAgency } from "@/lib/auth/session";
import { stages } from "@/lib/db";
import { listDriverNames, listOrders } from "@/lib/orders/queries";

export const metadata: Metadata = { title: "Completed deliveries" };

export default async function AgencyCompletedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; driver?: string; page?: string }>;
}) {
  const { tdb } = await requireAgency();
  const params = await searchParams;

  const allStages = await tdb.findMany(stages, { orderBy: asc(stages.position) });
  const drivers = await listDriverNames(tdb);

  const { rows, total } = await listOrders(tdb, {
    search: params.q,
    stageId: params.stage,
    driver: params.driver,
    onlyCompleted: true,
    perPage: 50,
    page: Number(params.page ?? 1) || 1,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Completed deliveries"
        description={`${total} order${total === 1 ? "" : "s"} delivered.`}
      />

      <AgencyFilters
        stages={allStages}
        drivers={drivers}
        basePath="/agency/completed"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No completed deliveries yet"
            description="Orders appear here once they have been confirmed as delivered."
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
