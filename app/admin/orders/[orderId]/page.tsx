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
import { OrderSummary } from "@/components/orders/order-summary";
import {
  FulfillmentBadge,
  StageBadge,
} from "@/components/orders/stage-badge";
import { listOrderEmailSends } from "@/lib/actions/emails";
import { requireOwner } from "@/lib/auth/session";
import { getOrderDetail, listDriverNames } from "@/lib/orders/queries";
import { buildTrackingLink } from "@/lib/tracking/links";
import { formatDateTime } from "@/lib/utils";
import { AssignDriverForm } from "./assign-driver-form";
import { OverrideStageForm } from "./override-stage-form";
import { RetryFulfillmentForm } from "./retry-fulfillment-form";
import { EmailLog } from "./email-log";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { tdb, store } = await requireOwner();

  const detail = await getOrderDetail(tdb, orderId);
  if (!detail) notFound();

  const { order, stage, allStages, history, proof, proofAuthor } = detail;
  const drivers = await listDriverNames(tdb);
  const emailSends = await listOrderEmailSends(order.id);
  const trackingLink = buildTrackingLink(store, order);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={order.customerName ?? order.customerEmail ?? undefined}
        action={
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-ink-600 underline"
          >
            ← All orders
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={stage} />
        <FulfillmentBadge order={order} />
        {proof ? (
          <Badge tone="success">Delivery confirmed</Badge>
        ) : (
          <Badge tone="neutral">Awaiting delivery confirmation</Badge>
        )}
        {order.cancelledAt ? <Badge tone="danger">Cancelled in Shopify</Badge> : null}
      </div>

      {order.cancelledAt ? (
        <Alert tone="danger" title="This order was cancelled">
          Cancelled on {formatDateTime(order.cancelledAt)}. Pending automated
          emails for it have been stopped.
        </Alert>
      ) : null}

      {order.fulfillmentError ? (
        <Alert tone="warning" title="Fulfillment note">
          {order.fulfillmentError}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Order details"
              description="Mirrored from Shopify."
            />
            <CardBody>
              <OrderSummary order={order} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Event history"
              description="Every recorded event, with its source. This is what the customer's timeline is built from."
            />
            <CardBody>
              <HistoryTimeline history={history} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Email log"
              description="Scheduled, sent, failed and skipped email for this order."
            />
            <CardBody>
              <EmailLog sends={emailSends} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Manual stage override"
              description="Recorded in the order history as a manual override, attributed to you."
            />
            <CardBody>
              <OverrideStageForm
                orderId={order.id}
                stages={allStages}
                currentStageId={order.currentStageId}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Driver"
              description="A label for the agency's own dispatch. Drivers have no account in this app."
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
            <CardHeader title="Proof of delivery" />
            <CardBody className="space-y-3 text-sm">
              {proof ? (
                <>
                  <Row
                    label="Delivered at"
                    value={formatDateTime(proof.deliveredAt)}
                  />
                  <Row
                    label="Declared by"
                    value={
                      proofAuthor
                        ? (proofAuthor.name ?? proofAuthor.email)
                        : "Unknown user"
                    }
                  />
                  <Row
                    label="Signed for by"
                    value={proof.recipientName ?? "Not recorded"}
                  />
                  <Row label="Driver" value={proof.driverName ?? "Not recorded"} />
                  {proof.notes ? (
                    <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700">
                      {proof.notes}
                    </p>
                  ) : null}
                  {proof.paperSignaturePhotoUrl ? (
                    <a
                      href={proof.paperSignaturePhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-medium text-ink-700 underline"
                    >
                      View photo of signed delivery note
                    </a>
                  ) : (
                    <p className="text-ink-500">
                      No photo of the signed paper note was uploaded.
                    </p>
                  )}
                  <p className="text-xs text-ink-400">
                    The customer signed a paper delivery note in person. This app
                    never captures a digital signature.
                  </p>
                </>
              ) : (
                <p className="text-ink-500">
                  No proof of delivery yet. The delivery agency records it when
                  the order has been handed over and the paper note signed.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Shopify fulfillment"
              description="Only sent once delivery is confirmed."
            />
            <CardBody className="space-y-3 text-sm">
              <Row
                label="Status"
                value={order.fulfillmentStatus.replace(/^\w/, (c) => c.toUpperCase())}
              />
              {order.fulfilledAt ? (
                <Row label="Fulfilled at" value={formatDateTime(order.fulfilledAt)} />
              ) : null}
              {order.shopifyFulfillmentId ? (
                <Row label="Fulfillment id" value={order.shopifyFulfillmentId} />
              ) : null}
              <RetryFulfillmentForm
                orderId={order.id}
                disabled={order.fulfillmentStatus === "fulfilled"}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customer tracking page" />
            <CardBody className="space-y-2 text-sm">
              <p className="text-ink-600">
                This is the link used in emails. It opens on the store&rsquo;s own
                domain through the Shopify App Proxy.
              </p>
              <code className="block overflow-x-auto rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">
                {trackingLink}
              </code>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-ink-500">{label}</span>
      <span className="break-all text-right font-medium text-ink-900">
        {value}
      </span>
    </div>
  );
}
