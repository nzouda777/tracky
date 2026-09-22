/**
 * Default tracking stages for a newly connected store, in English.
 *
 * These are only a starting point: the owner can rename, reorder, add and
 * delete stages from the backoffice. Nothing in the codebase depends on these
 * particular keys — stage behaviour is driven by the flags, not by the slug.
 */
export type DefaultStage = {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isTerminal?: boolean;
  triggersFulfillment?: boolean;
  locksAddressEditing?: boolean;
  advancesOnPayment?: boolean;
};

export const DEFAULT_STAGES: DefaultStage[] = [
  {
    key: "order-placed",
    name: "Order Placed",
    description: "We have received your order and payment.",
    icon: "receipt",
    color: "#64748b",
  },
  {
    key: "confirmed",
    name: "Confirmed",
    description: "Your order has been confirmed and is queued for packing.",
    icon: "check",
    color: "#2563eb",
    // Reached on its own, when Shopify reports the payment.
    advancesOnPayment: true,
  },
  {
    key: "processing",
    name: "Processing",
    description: "Your items are being picked and packed.",
    icon: "package",
    color: "#7c3aed",
  },
  {
    key: "out-for-delivery",
    name: "Out for Delivery",
    description: "Your order is with our driver and on the way to you.",
    icon: "truck",
    color: "#ea580c",
    // From here on the parcel is physically moving, so the address is frozen.
    locksAddressEditing: true,
  },
  {
    key: "delivered",
    name: "Delivered",
    description: "Your order has been delivered and signed for.",
    icon: "home",
    color: "#059669",
    isTerminal: true,
    // Fulfilment is pushed to Shopify only when the delivery agency confirms
    // this stage with a proof of delivery.
    triggersFulfillment: true,
  },
];

/** Available stage icons, used by the stage editor's picker. */
export const STAGE_ICONS = [
  "circle",
  "receipt",
  "check",
  "package",
  "truck",
  "home",
  "clock",
  "warehouse",
  "map-pin",
  "alert",
] as const;

export type StageIcon = (typeof STAGE_ICONS)[number];
