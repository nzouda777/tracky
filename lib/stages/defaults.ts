/**
 * Default tracking stages for a newly connected store, in English.
 *
 * These are only a starting point: the owner can rename, reorder, add and
 * delete stages from the backoffice. Nothing in the codebase depends on these
 * particular keys — stage behaviour is driven by the flags, not by the slug.
 */
/**
 * The four phases the customer's progress bar is drawn in.
 *
 * Every stage belongs to exactly one phase. The detailed stage list can be as
 * long as a store likes — the default set has 37 steps — while the bar at the
 * top of the tracking page stays a readable four: Order Placed, Processing,
 * In Transit, Delivered.
 */
export const STAGE_PHASES = [
  { id: "placed", label: "Order Placed" },
  { id: "processing", label: "Processing" },
  { id: "transit", label: "In Transit" },
  { id: "delivered", label: "Delivered" },
] as const;

export type StagePhase = (typeof STAGE_PHASES)[number]["id"];

export function isStagePhase(value: unknown): value is StagePhase {
  return STAGE_PHASES.some((phase) => phase.id === value);
}

export function phaseLabel(phase: string): string {
  return STAGE_PHASES.find((entry) => entry.id === phase)?.label ?? phase;
}

/**
 * A stage's phase, tolerating rows written before phases existed: a terminal
 * stage is always delivered, and an unknown value reads as processing.
 */
export function phaseOf(stage: {
  phase?: string | null;
  isTerminal?: boolean | null;
}): StagePhase {
  if (stage.isTerminal) return "delivered";
  return isStagePhase(stage.phase) ? stage.phase : "processing";
}

export type DefaultStage = {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  phase: StagePhase;
  isTerminal?: boolean;
  triggersFulfillment?: boolean;
  locksAddressEditing?: boolean;
  advancesOnPayment?: boolean;
};

/**
 * The full delivery sequence, from checkout to the doorstep, including the
 * setbacks an international parcel typically meets on the way (customs
 * checks, failed attempts, depot backlogs). A step only appears on a
 * customer's page once someone records it, so stages an order never goes
 * through are simply never shown to that customer.
 *
 * Names may repeat but keys never do: the five "Out for Delivery" rounds are
 * distinct stages (`out-for-delivery`, `out-for-delivery-2` …) with their
 * own wording.
 */
export const DEFAULT_STAGES: DefaultStage[] = [
  {
    key: "order-placed",
    name: "Order Placed",
    description: "Your order was submitted successfully.",
    icon: "receipt",
    color: "#64748b",
    phase: "placed",
  },
  {
    key: "confirmed",
    name: "Order Confirmed",
    description:
      "The order has been placed and is currently being processed.",
    icon: "check",
    color: "#2563eb",
    phase: "processing",
    // Reached on its own, when Shopify reports the payment.
    advancesOnPayment: true,
  },
  {
    key: "quality-check-passed",
    name: "Quality Check Passed",
    description:
      "The item has passed quality inspection and is being carefully packaged for international shipping.",
    icon: "check",
    color: "#2563eb",
    phase: "processing",
  },
  {
    key: "ready-to-ship",
    name: "Ready to Ship",
    description:
      "The order is fully packaged and awaiting carrier pickup.",
    icon: "package",
    color: "#7c3aed",
    phase: "processing",
  },
  {
    key: "pickup-scheduled",
    name: "Pickup Scheduled",
    description: "The carrier has confirmed the pickup for tomorrow.",
    icon: "clock",
    color: "#7c3aed",
    phase: "processing",
  },
  {
    key: "picked-up-by-carrier",
    name: "Picked Up by Carrier",
    description:
      "The package has been collected by the international carrier.",
    icon: "truck",
    color: "#0891b2",
    phase: "transit",
  },
  {
    key: "at-sorting-center",
    name: "At Sorting Center",
    description:
      "The package has reached the sorting facility and is being processed.",
    icon: "warehouse",
    color: "#0891b2",
    phase: "transit",
  },
  {
    key: "hold-at-sorting-center",
    name: "Hold at Sorting Center",
    description:
      "The package is held due to high shipment volumes. It is being processed as a priority.",
    icon: "alert",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "in-transit",
    name: "In Transit",
    description:
      "The package has departed and is now in international transit.",
    icon: "truck",
    color: "#0891b2",
    phase: "transit",
  },
  {
    key: "in-transit-update",
    name: "In Transit Update",
    description:
      "The package is progressing through the international network and is on schedule.",
    icon: "truck",
    color: "#0891b2",
    phase: "transit",
  },
  {
    key: "cargo-route-rescheduled",
    name: "Cargo Route Rescheduled",
    description:
      "The package was rescheduled onto a different cargo route due to capacity constraints. It is back on track.",
    icon: "alert",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "in-transit-again",
    name: "In Transit Again",
    description: "The package is back in transit on its new route.",
    icon: "truck",
    color: "#0891b2",
    phase: "transit",
  },
  {
    key: "arrived-at-customs",
    name: "Arrived at Customs",
    description:
      "The package has arrived at the customs import facility. Standard processing is underway.",
    icon: "warehouse",
    color: "#4f46e5",
    phase: "transit",
  },
  {
    key: "customs-processing",
    name: "Customs Processing",
    description:
      "The package is in the customs queue. This is normal for international shipments. No action needed.",
    icon: "clock",
    color: "#4f46e5",
    phase: "transit",
  },
  {
    key: "customs-verification",
    name: "Customs Verification",
    description:
      "Customs requested a routine additional verification. Standard procedure, no issue.",
    icon: "alert",
    color: "#4f46e5",
    phase: "transit",
  },
  {
    key: "customs-cleared",
    name: "Customs Cleared",
    description:
      "The package has passed all customs checks and has been released.",
    icon: "check",
    color: "#4f46e5",
    phase: "transit",
  },
  {
    key: "local-delivery-network",
    name: "Local Delivery Network",
    description: "The package is now in the domestic delivery system.",
    icon: "map-pin",
    color: "#0d9488",
    phase: "transit",
  },
  {
    key: "at-regional-hub",
    name: "At Regional Hub",
    description:
      "The package is at the regional distribution hub and being sorted for local delivery.",
    icon: "warehouse",
    color: "#0d9488",
    phase: "transit",
  },
  {
    key: "at-local-depot",
    name: "At Local Depot",
    description:
      "The package arrived at the depot closest to the delivery address. Delivery is being scheduled.",
    icon: "warehouse",
    color: "#0d9488",
    phase: "transit",
  },
  {
    key: "out-for-delivery",
    name: "Out for Delivery",
    description: "The driver is on the way with the package today.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
    // From here on the parcel is on a van, so the address is frozen.
    locksAddressEditing: true,
  },
  {
    key: "delivery-attempted",
    name: "Delivery Attempted",
    description:
      "No one was available at the address. A second attempt has been scheduled.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "vehicle-breakdown",
    name: "Vehicle Breakdown",
    description:
      "Vehicle breakdown during delivery. Package returned to depot, re-dispatch tomorrow morning.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "out-for-delivery-2",
    name: "Out for Delivery",
    description:
      "Package loaded onto a new vehicle. The driver is on the way.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
  },
  {
    key: "delivery-attempted-2",
    name: "Delivery Attempted",
    description:
      "Unable to access address – incorrect building entry code. Package held at depot.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "held-at-depot",
    name: "Held at Depot",
    description:
      "Package held while delivery details are being confirmed.",
    icon: "warehouse",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "misrouted-correcting",
    name: "Misrouted – Correcting",
    description:
      "Package temporarily misrouted to an adjacent zone. Identified and being redirected.",
    icon: "alert",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "back-at-facility",
    name: "Back at Facility",
    description:
      "Package returned to the correct depot. New delivery scheduled.",
    icon: "warehouse",
    color: "#0d9488",
    phase: "transit",
  },
  {
    key: "out-for-delivery-3",
    name: "Out for Delivery",
    description: "The driver is heading to the address today.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
  },
  {
    key: "delivery-attempted-3",
    name: "Delivery Attempted",
    description:
      "Road restrictions due to a local event. Package at depot, re-dispatch shortly.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "depot-backlog",
    name: "Depot Backlog",
    description:
      "High delivery volumes have caused a backlog. Package in the queue, dispatched ASAP.",
    icon: "clock",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "out-for-delivery-4",
    name: "Out for Delivery",
    description:
      "The package is on the vehicle. The driver is completing the delivery round.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
  },
  {
    key: "delivery-attempted-4",
    name: "Delivery Attempted",
    description:
      "Address label suffered minor damage. Address confirmed, re-dispatch tomorrow.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "operational-disruption",
    name: "Operational Disruption",
    description:
      "The local depot is experiencing a temporary disruption. Deliveries in the area are delayed.",
    icon: "alert",
    color: "#d97706",
    phase: "transit",
  },
  {
    key: "out-for-delivery-5",
    name: "Out for Delivery",
    description: "The package is on its way today.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
  },
  {
    key: "delivery-attempt-scheduled-today",
    name: "Delivery Attempt Scheduled Today",
    description:
      "Access to the building was blocked. Cannot leave without a signature. Final attempt tomorrow.",
    icon: "alert",
    color: "#dc2626",
    phase: "transit",
  },
  {
    key: "final-delivery-attempt-scheduled",
    name: "Final Delivery Attempt Scheduled",
    description:
      "A final delivery attempt is scheduled for today. The driver is on the way.",
    icon: "truck",
    color: "#ea580c",
    phase: "transit",
  },
  {
    key: "delivered",
    name: "Delivery complete",
    description:
      "Your order has been delivered. If you have not received it within 24 hours, please reply to this email and we will follow up with the carrier on your behalf.",
    icon: "home",
    color: "#059669",
    phase: "delivered",
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
