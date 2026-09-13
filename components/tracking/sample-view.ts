import type { Order, Stage } from "@/lib/db";
import type { PublicOrderView } from "@/lib/tracking/lookup";
import { buildTimeline } from "@/lib/orders/stages";

/**
 * A clearly-labelled example order used only by the branding preview.
 *
 * It never touches the database and is never shown to a customer: it exists so
 * an owner can see their colours, logo and copy applied to a realistic page
 * while editing. Real tracking pages are built exclusively from real events.
 */
export function buildSampleView(stages: Stage[]): PublicOrderView {
  const now = Date.now();

  const order = {
    id: "sample",
    storeId: "sample",
    shopifyOrderId: "0",
    orderNumber: "#1042",
    customerName: "Sarah Jenkins",
    customerEmail: "sarah@example.com",
    customerPhone: "+61 400 000 000",
    shippingAddress: {
      name: "Sarah Jenkins",
      address1: "12 Bourke Street",
      address2: "Apartment 4",
      city: "Melbourne",
      province: "VIC",
      zip: "3000",
      country: "Australia",
    },
    lineItems: [
      { title: "Cedar Side Table", quantity: 1, price: "249.00" },
      {
        title: "Linen Cushion Cover",
        variantTitle: "Sand / 50×50",
        quantity: 2,
        price: "39.00",
      },
    ],
    orderDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
    total: "327.00",
    currency: "AUD",
    currentStageId: stages[Math.min(1, stages.length - 1)]?.id ?? null,
    fulfillmentStatus: "unfulfilled",
    shopifyFulfillmentId: null,
    fulfilledAt: null,
    fulfillmentError: null,
    assignedDriverName: null,
    trackingToken: "sample",
    cancelledAt: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  } satisfies Order;

  const currentStage =
    stages.find((stage) => stage.id === order.currentStageId) ?? null;

  const event = {
    id: "sample-event",
    storeId: "sample",
    orderId: "sample",
    stageId: currentStage?.id ?? "sample-stage",
    occurredAt: new Date(now - 2 * 60 * 60 * 1000),
    note: "This is an example update, shown only in this preview.",
    createdByUserId: null,
    source: "agency" as const,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };

  return {
    order,
    stage: currentStage,
    timeline: buildTimeline(stages, order.currentStageId),
    events: currentStage ? [{ event, stage: currentStage }] : [],
    lastUpdate: currentStage ? { event, stage: currentStage } : null,
    proof: null,
    canEditAddress: true,
  };
}
