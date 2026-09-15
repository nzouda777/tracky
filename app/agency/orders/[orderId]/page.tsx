import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { HistoryTimeline } from "@/components/orders/history-timeline";
import { StageBadge } from "@/components/orders/stage-badge";
import { AdvanceStageForm } from "@/components/agency/advance-stage-form";
import { AssignDriverForm } from "@/components/agency/assign-driver-form";
import { MarkDeliveredForm } from "@/components/agency/mark-delivered-form";
import { requireAgency } from "@/lib/auth/session";
import { getOrderDetail, listDriverNames } from "@/lib/orders/queries";
import {
  formatAddressLines,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery" };

export default async function AgencyOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { tdb } = await requireAgency();

  const detail = await getOrderDetail(tdb, orderId);
  if (!detail) notFound();

  const { order, stage, allStages, history, proof, proofAuthor } = detail;
  const drivers = await listDriverNames(tdb);
  const addressLines = formatAddressLines(order.shippingAddress);
  const terminalStage = allStages.find((entry) => entry.isTerminal);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={order.customerName ?? undefined}
        action={
          <Link href="/agency" className="text-sm font-medium text-ink-600 underline">
            ← Back
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={stage} />
        {order.assignedDriverName ? (
          <Badge tone="info">Driver: {order.assignedDriverName}</Badge>
        ) : (
          <Badge tone="warning">No driver assigned</Badge>
        )}
        {proof ? <Badge tone="success">Delivery confirmed</Badge> : null}
        {order.cancelledAt ? <Badge tone="danger">Cancelled</Badge> : null}
      </div>

      {order.cancelledAt ? (
        <Alert tone="danger" title="Cancelled in Shopify">
          Do not deliver this order. It was cancelled on{" "}
          {formatDate(order.cancelledAt)}.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Delivery details" />
        <CardBody className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-ink-500">
              Deliver to
            </p>
            {addressLines.length > 0 ? (
              <address className="mt-1 not-italic leading-relaxed text-ink-900">
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : (
              <p className="mt-1 text-ink-500">No address on this order.</p>
            )}
          </div>

          {order.customerPhone ? (
            <p>
              <span className="text-ink-500">Phone: </span>
              <a
                href={`tel:${order.customerPhone}`}
                className="font-medium text-ink-900 underline"
              >
                {order.customerPhone}
              </a>
            </p>
          ) : null}

          <div>
            <p className="text-xs font-semibold text-ink-500">
              Items
            </p>
            <ul className="mt-1 space-y-1">
              {order.lineItems.length === 0 ? (
                <li className="text-ink-500">No items recorded.</li>
              ) : (
                order.lineItems.map((item, index) => (
                  <li key={`${item.id ?? item.title}-${index}`}>
                    {item.quantity} × {item.title}
                    {item.variantTitle ? ` — ${item.variantTitle}` : ""}
                  </li>
                ))
              )}
            </ul>
          </div>

          <p className="text-ink-600">
            Order total: {formatMoney(order.total, order.currency)} · placed{" "}
            {formatDate(order.orderDate)}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Assign a driver"
          description="A label for your own dispatch. Drivers do not log in to this app."
        />
        <CardBody>
          <AssignDriverForm
            orderId={order.id}
            currentDriver={order.assignedDriverName}
            knownDrivers={drivers}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Update status"
          description="Each update is recorded with your name and shown to the customer."
        />
        <CardBody>
          <AdvanceStageForm
            orderId={order.id}
            stages={allStages}
            currentStageId={order.currentStageId}
            disabled={Boolean(order.cancelledAt)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Mark as delivered"
          description="Use this once the order has been handed over and the paper delivery note has been signed."
        />
        <CardBody>
          {proof ? (
            <div className="space-y-2 text-sm">
              <Alert tone="success" title="Delivery already confirmed">
                Recorded {formatDateTime(proof.deliveredAt)} by{" "}
                {proofAuthor?.name ?? proofAuthor?.email ?? "an agency user"}.
              </Alert>
              {proof.recipientName ? (
                <p className="text-ink-600">
                  Signed for by {proof.recipientName}.
                </p>
              ) : null}
              {proof.paperSignaturePhotoUrl ? (
                <a
                  href={proof.paperSignaturePhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-medium text-ink-700 underline"
                >
                  View photo of the signed note
                </a>
              ) : null}
            </div>
          ) : terminalStage ? (
            <MarkDeliveredForm
              orderId={order.id}
              storeId={order.storeId}
              terminalStageName={terminalStage.name}
              defaultRecipient={order.customerName}
              disabled={Boolean(order.cancelledAt)}
            />
          ) : (
            <Alert tone="warning">
              This store has no terminal stage configured, so deliveries cannot
              be confirmed. Ask the store owner to mark one.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="History" />
        <CardBody>
          <HistoryTimeline history={history} />
        </CardBody>
      </Card>
    </div>
  );
}
