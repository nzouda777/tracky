import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";

import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { FulfillmentBadge, StageBadge } from "@/components/orders/stage-badge";
import { requireOwner } from "@/lib/auth/session";
import { stages } from "@/lib/db";
import { listOrders } from "@/lib/orders/queries";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import { OrderFilters } from "./order-filters";
import { BulkEmailBar } from "./bulk-email-bar";
import { listActiveTemplates } from "@/lib/actions/emails";
import { SyncOrdersButton } from "@/components/admin/sync-orders-button";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const { tdb } = await requireOwner();
  const params = await searchParams;

  const allStages = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });

  const { rows, total, page, perPage } = await listOrders(tdb, {
    search: params.q,
    stageId: params.stage,
    onlyActive: params.status === "active",
    onlyCompleted: params.status === "completed",
    page: Number(params.page ?? 1) || 1,
  });

  const templates = await listActiveTemplates();
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} synced from Shopify.`}
        action={<SyncOrdersButton compact />}
      />

      <OrderFilters stages={allStages} />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="No orders match"
            description="Orders arrive automatically when Shopify sends an orders/create webhook. Adjust the filters, place a test order, or use Sync orders to pull in anything a webhook missed."
          />
        ) : (
          <BulkEmailBar templates={templates} orderIds={rows.map((row) => row.order.id)}>
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-10" />
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Stage</Th>
                  <Th>Driver</Th>
                  <Th>Fulfillment</Th>
                  <Th>Placed</Th>
                  <Th>Last update</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ order, stage, hasProof }) => (
                  <tr key={order.id} className="hover:bg-ink-50">
                    <Td>
                      <input
                        type="checkbox"
                        name="orderIds"
                        value={order.id}
                        aria-label={`Select order ${order.orderNumber}`}
                        className="size-4 rounded border-ink-300"
                      />
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.cancelledAt ? (
                        <span className="ml-2">
                          <Badge tone="danger">Cancelled</Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="block text-ink-900">
                        {order.customerName ?? "—"}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {order.customerEmail ?? "No email"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <StageBadge stage={stage} />
                        {hasProof ? (
                          <span className="text-xs text-emerald-700">
                            Delivery confirmed
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-ink-600">
                      {order.assignedDriverName ?? "—"}
                    </Td>
                    <Td>
                      <FulfillmentBadge order={order} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">
                      {formatDate(order.orderDate)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">
                      {formatRelative(order.updatedAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-900">
                      {formatMoney(order.total, order.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </BulkEmailBar>
        )}
      </Card>

      {lastPage > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          <PageLink
            params={params}
            page={page - 1}
            disabled={page <= 1}
            label="← Previous"
          />
          <span className="text-ink-500">
            Page {page} of {lastPage}
          </span>
          <PageLink
            params={params}
            page={page + 1}
            disabled={page >= lastPage}
            label="Next →"
          />
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  label,
}: {
  params: Record<string, string | undefined>;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return <span className="text-ink-300">{label}</span>;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  search.set("page", String(page));

  return (
    <Link
      href={`/admin/orders?${search.toString()}`}
      className="font-medium text-ink-700 underline"
    >
      {label}
    </Link>
  );
}
