import { Badge } from "@/components/ui";
import type { Order, Stage } from "@/lib/db";

/** The order's current stage, using the stage's own configured colour. */
export function StageBadge({ stage }: { stage: Stage | null }) {
  if (!stage) {
    return <Badge tone="neutral">No stage</Badge>;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      style={{
        color: stage.color,
        backgroundColor: `${stage.color}14`,
        borderColor: stage.color,
        boxShadow: `inset 0 0 0 1px ${stage.color}33`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: stage.color }}
      />
      {stage.name}
    </span>
  );
}

export function FulfillmentBadge({
  order,
}: {
  order: Pick<Order, "fulfillmentStatus" | "fulfillmentError">;
}) {
  switch (order.fulfillmentStatus) {
    case "fulfilled":
      return <Badge tone="success">Fulfilled</Badge>;
    case "partial":
      return <Badge tone="info">Partially fulfilled</Badge>;
    case "failed":
      return <Badge tone="danger">Fulfillment failed</Badge>;
    default:
      return <Badge tone="neutral">Unfulfilled</Badge>;
  }
}

export function ProofBadge({ hasProof }: { hasProof: boolean }) {
  return hasProof ? (
    <Badge tone="success">Delivery confirmed</Badge>
  ) : (
    <Badge tone="neutral">No proof yet</Badge>
  );
}
