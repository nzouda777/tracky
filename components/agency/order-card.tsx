import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { StageBadge } from "@/components/orders/stage-badge";
import type { Order, Stage } from "@/lib/db";
import { formatAddressOneLine, formatRelative } from "@/lib/utils";

/** One delivery, sized for a phone screen and a gloved thumb. */
export function AgencyOrderCard({
  order,
  stage,
  hasProof,
}: {
  order: Order;
  stage: Stage | null;
  hasProof: boolean;
}) {
  return (
    <Card>
      <Link
        href={`/agency/orders/${order.id}`}
        className="block px-4 py-4 transition-colors hover:bg-ink-50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold text-ink-900">
              {order.orderNumber}
            </p>
            <p className="truncate text-sm text-ink-700">
              {order.customerName ?? "No name on order"}
            </p>
            <p className="text-sm text-ink-500">
              {formatAddressOneLine(order.shippingAddress)}
            </p>
          </div>
          <span aria-hidden className="mt-1 shrink-0 text-ink-300">
            ›
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StageBadge stage={stage} />
          {order.assignedDriverName ? (
            <Badge tone="info">{order.assignedDriverName}</Badge>
          ) : (
            <Badge tone="warning">No driver</Badge>
          )}
          {hasProof ? <Badge tone="success">Delivered</Badge> : null}
          {order.cancelledAt ? <Badge tone="danger">Cancelled</Badge> : null}
          <span className="ml-auto text-xs text-ink-400">
            updated {formatRelative(order.updatedAt)}
          </span>
        </div>
      </Link>
    </Card>
  );
}
