"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAgency, requireOwner, requireStoreAccess } from "@/lib/auth/session";
import { orders, proofOfDelivery, stages } from "@/lib/db";
import { retryFulfillment } from "@/lib/fulfillment";
import { getStageById } from "@/lib/orders/stages";
import { recordStageTransition } from "@/lib/orders/transitions";
import { guard, type ActionResult } from "./result";

/**
 * Every order mutation in the app. Each one is a real, attributed human action:
 * the authenticated user id and a `source` are written into
 * `order_stage_history`, and nothing here is reachable from a scheduler.
 */

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/agency");
  revalidatePath(`/agency/orders/${orderId}`);
}

/**
 * Admin manual override. Writes history with `source = admin`, so the timeline
 * still shows who changed what and when.
 */
export async function overrideStageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb, user } = await requireOwner();

    const orderId = String(formData.get("orderId") ?? "");
    const stageId = String(formData.get("stageId") ?? "");
    const note = String(formData.get("note") ?? "");

    const order = await tdb.findById(orders, orderId);
    if (!order) return { error: "That order no longer exists." };
    if (!stageId) return { fieldErrors: { stageId: "Choose a stage." } };

    const result = await recordStageTransition({
      tdb,
      order,
      stageId,
      source: "admin",
      note,
      userId: user.id,
    });

    revalidateOrder(orderId);

    const fulfillmentNote = describeFulfillment(result.fulfillment);
    return {
      ok: true,
      message: `Order moved to "${result.stage.name}".${fulfillmentNote}`,
    };
  });
}

/**
 * Agency stage update. Identical mechanics to the admin override, recorded with
 * `source = agency`.
 */
export async function advanceStageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb, user } = await requireAgency();

    const orderId = String(formData.get("orderId") ?? "");
    const stageId = String(formData.get("stageId") ?? "");
    const note = String(formData.get("note") ?? "");

    const order = await tdb.findById(orders, orderId);
    if (!order) return { error: "That order no longer exists." };
    if (order.cancelledAt) {
      return { error: "This order was cancelled in Shopify." };
    }

    const stage = await getStageById(tdb, stageId);
    if (!stage) return { fieldErrors: { stageId: "Choose a stage." } };

    // Reaching a terminal / fulfillment-triggering stage means the order was
    // delivered, which requires a proof of delivery. Send the user to the
    // dedicated delivery form instead of silently fulfilling without proof.
    if (stage.isTerminal || stage.triggersFulfillment) {
      const proof = await tdb.findFirst(proofOfDelivery, {
        where: eq(proofOfDelivery.orderId, orderId),
      });
      if (!proof) {
        return {
          error: `Use "Mark as delivered" to move an order to ${stage.name}, so the delivery is recorded with its proof of delivery.`,
        };
      }
    }

    const result = await recordStageTransition({
      tdb,
      order,
      stageId,
      source: "agency",
      note,
      userId: user.id,
    });

    revalidateOrder(orderId);
    return {
      ok: true,
      message: `Updated to "${result.stage.name}".`,
    };
  });
}

/**
 * The delivery declaration.
 *
 * The driver has already handed over the parcel and had the customer sign the
 * PAPER delivery note; this records that fact. It creates the
 * `proof_of_delivery` row first, then moves the order to the terminal stage —
 * in that order, so auto-fulfillment sees the proof and can fire.
 *
 * There is no digital signature capture: the proof is the agency's attributed
 * declaration, plus an optional photo of the signed paper note.
 */
export async function markDeliveredAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    // Owners are inside `requireAgency`, deliberately: a store that runs its
    // own deliveries has no separate agency to wait for, and the declaration
    // is the only thing standing between a delivered order and a fulfilled
    // one. What changes with the role is the attribution, not the permission.
    const { tdb, user, role } = await requireAgency();

    const orderId = String(formData.get("orderId") ?? "");
    const recipientName = String(formData.get("recipientName") ?? "").trim();
    const photoUrl = String(formData.get("paperSignaturePhotoUrl") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const deliveredAtRaw = String(formData.get("deliveredAt") ?? "").trim();

    const order = await tdb.findById(orders, orderId);
    if (!order) return { error: "That order no longer exists." };
    if (order.cancelledAt) {
      return { error: "This order was cancelled in Shopify." };
    }

    const allStages = await tdb.findMany(stages);
    const terminal =
      allStages.find((stage) => stage.isTerminal) ??
      allStages.sort((a, b) => b.position - a.position)[0];

    if (!terminal) {
      return { error: "This store has no terminal stage configured." };
    }

    // A delivery time in the future would be a data-entry mistake, not a fact.
    const parsed = deliveredAtRaw ? new Date(deliveredAtRaw) : new Date();
    const deliveredAt =
      Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 60_000
        ? new Date()
        : parsed;

    const existingProof = await tdb.findFirst(proofOfDelivery, {
      where: eq(proofOfDelivery.orderId, orderId),
    });

    if (existingProof) {
      await tdb.updateById(proofOfDelivery, existingProof.id, {
        recipientName: recipientName || existingProof.recipientName,
        paperSignaturePhotoUrl: photoUrl || existingProof.paperSignaturePhotoUrl,
        notes: notes || existingProof.notes,
        updatedAt: new Date(),
      });
    } else {
      await tdb.insertOne(proofOfDelivery, {
        orderId,
        markedDeliveredByUserId: user.id,
        deliveredAt,
        recipientName: recipientName || null,
        paperSignaturePhotoUrl: photoUrl || null,
        driverName: order.assignedDriverName,
        notes: notes || null,
      });
    }

    const result = await recordStageTransition({
      tdb,
      order,
      stageId: terminal.id,
      // The timeline is an audit trail: it records who really declared this,
      // not which form they happened to use.
      source: role === "owner" ? "admin" : "agency",
      note:
        notes ||
        (recipientName
          ? `Delivered and signed for by ${recipientName}.`
          : "Delivered and signed for."),
      userId: user.id,
      occurredAt: deliveredAt,
    });

    revalidateOrder(orderId);

    return {
      ok: true,
      message: `Order marked delivered.${describeFulfillment(result.fulfillment)}`,
    };
  });
}

/** Assigns a driver label. Drivers have no accounts; this is a note for dispatch. */
export async function assignDriverAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    // Both the agency and the owner may assign a driver.
    const { tdb } = await requireStoreAccess(["agency", "owner"]);

    const orderId = String(formData.get("orderId") ?? "");
    const driverName = String(formData.get("driverName") ?? "").trim();

    const order = await tdb.findById(orders, orderId);
    if (!order) return { error: "That order no longer exists." };

    await tdb.updateById(orders, orderId, {
      assignedDriverName: driverName || null,
      updatedAt: new Date(),
    });

    revalidateOrder(orderId);
    return {
      ok: true,
      message: driverName
        ? `Assigned to ${driverName}.`
        : "Driver assignment cleared.",
    };
  });
}

/** Re-attempts a failed Shopify fulfillment. Still requires proof of delivery. */
export async function retryFulfillmentAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const orderId = String(formData.get("orderId") ?? "");

    const order = await tdb.findById(orders, orderId);
    if (!order) return { error: "That order no longer exists." };
    if (!order.currentStageId) {
      return { error: "This order is not in a stage yet." };
    }

    const stage = await getStageById(tdb, order.currentStageId);
    if (!stage?.triggersFulfillment) {
      return {
        error:
          "This order is not in a stage that triggers fulfillment. Move it to the delivered stage first.",
      };
    }

    const outcome = await retryFulfillment({ tdb, order, stage });
    revalidateOrder(orderId);

    switch (outcome.status) {
      case "fulfilled":
        return { ok: true, message: "Order fulfilled in Shopify." };
      case "already-fulfilled":
        return { ok: true, message: "Shopify already has this order fulfilled." };
      case "skipped":
        return { ok: true, message: `Not fulfilled: ${outcome.reason}` };
      case "failed":
        return { error: `Fulfillment failed: ${outcome.error}` };
    }
  });
}

function describeFulfillment(
  outcome: Awaited<ReturnType<typeof retryFulfillment>> | null,
): string {
  if (!outcome) return "";
  switch (outcome.status) {
    case "fulfilled":
      return " Shopify fulfillment created.";
    case "already-fulfilled":
      return " Shopify already had this order fulfilled.";
    case "skipped":
      return ` Fulfillment not sent: ${outcome.reason}`;
    case "failed":
      return ` Fulfillment failed: ${outcome.error}`;
  }
}
