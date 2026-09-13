"use server";

import { asc, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import { orderStageHistory, orders, stages } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { guard, type ActionResult } from "./result";

/**
 * Stage CRUD. Stages are the backbone of the public timeline, so the rules
 * enforced here protect data that customers already saw:
 *
 *  - a store always keeps at least one stage;
 *  - a stage that already has history cannot be deleted, only renamed, because
 *    deleting it would rewrite a customer's past;
 *  - positions are always renumbered contiguously from 0.
 */

function revalidateStages() {
  revalidatePath("/admin/stages");
  revalidatePath("/admin/orders");
  revalidatePath("/agency");
}

async function nextPosition(storeId: string, tdb: Awaited<ReturnType<typeof requireOwner>>["tdb"]) {
  const rows = await tdb.findMany(stages, { orderBy: asc(stages.position) });
  return rows.length;
}

/** Builds a store-unique key from a name, e.g. "Out for Delivery" → out-for-delivery. */
async function uniqueKey(
  tdb: Awaited<ReturnType<typeof requireOwner>>["tdb"],
  name: string,
  excludeStageId?: string,
): Promise<string> {
  const base = slugify(name) || "stage";
  const existing = await tdb.findMany(stages);
  const taken = new Set(
    existing
      .filter((stage) => stage.id !== excludeStageId)
      .map((stage) => stage.key),
  );

  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function createStageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb, store } = await requireOwner();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { fieldErrors: { name: "Enter a stage name." } };
    }

    await tdb.insertOne(stages, {
      key: await uniqueKey(tdb, name),
      name,
      description: String(formData.get("description") ?? "").trim(),
      position: await nextPosition(store.id, tdb),
      icon: String(formData.get("icon") ?? "circle"),
      color: String(formData.get("color") ?? "#2563eb"),
      isTerminal: formData.get("isTerminal") === "on",
      triggersFulfillment: formData.get("triggersFulfillment") === "on",
      locksAddressEditing: formData.get("locksAddressEditing") === "on",
    });

    revalidateStages();
    return { ok: true, message: `Stage "${name}" added.` };
  });
}

export async function updateStageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const stageId = String(formData.get("stageId") ?? "");

    const stage = await tdb.findById(stages, stageId);
    if (!stage) return { error: "That stage no longer exists." };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { fieldErrors: { name: "Enter a stage name." } };

    await tdb.updateById(stages, stageId, {
      name,
      description: String(formData.get("description") ?? "").trim(),
      icon: String(formData.get("icon") ?? stage.icon),
      color: String(formData.get("color") ?? stage.color),
      isTerminal: formData.get("isTerminal") === "on",
      triggersFulfillment: formData.get("triggersFulfillment") === "on",
      locksAddressEditing: formData.get("locksAddressEditing") === "on",
      updatedAt: new Date(),
    });

    revalidateStages();
    return { ok: true, message: `Stage "${name}" saved.` };
  });
}

export async function deleteStageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const stageId = String(formData.get("stageId") ?? "");

    const stage = await tdb.findById(stages, stageId);
    if (!stage) return { error: "That stage no longer exists." };

    const remaining = await tdb.findMany(stages, {
      where: ne(stages.id, stageId),
    });
    if (remaining.length === 0) {
      return { error: "A store must keep at least one stage." };
    }

    // History is what customers already saw; it is never rewritten.
    const [{ value: historyCount }] = await tdb.raw
      .select({ value: count() })
      .from(orderStageHistory)
      .where(tdb.scope(orderStageHistory, eq(orderStageHistory.stageId, stageId)));

    if (Number(historyCount) > 0) {
      return {
        error:
          "This stage is already part of at least one order's history, so it cannot be deleted. Rename it instead.",
      };
    }

    const [{ value: orderCount }] = await tdb.raw
      .select({ value: count() })
      .from(orders)
      .where(tdb.scope(orders, eq(orders.currentStageId, stageId)));

    if (Number(orderCount) > 0) {
      return {
        error:
          "Some orders are currently in this stage. Move them to another stage first.",
      };
    }

    await tdb.deleteById(stages, stageId);
    await renumber(tdb);

    revalidateStages();
    return { ok: true, message: `Stage "${stage.name}" deleted.` };
  });
}

/**
 * Applies a new order from the drag-and-drop editor.
 * Ids that do not belong to the store are simply ignored by the tenant client.
 */
export async function reorderStagesAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const raw = String(formData.get("order") ?? "");
    const requested = raw.split(",").filter(Boolean);

    const existing = await tdb.findMany(stages, {
      orderBy: asc(stages.position),
    });
    const byId = new Map(existing.map((stage) => [stage.id, stage]));

    const ordered = requested.filter((id) => byId.has(id));
    // Anything the client did not mention keeps its relative place at the end.
    for (const stage of existing) {
      if (!ordered.includes(stage.id)) ordered.push(stage.id);
    }

    await Promise.all(
      ordered.map((id, index) =>
        tdb.updateById(stages, id, { position: index, updatedAt: new Date() }),
      ),
    );

    revalidateStages();
    return { ok: true, message: "Stage order saved." };
  });
}

/** Collapses any gaps in `position` after a delete. */
async function renumber(
  tdb: Awaited<ReturnType<typeof requireOwner>>["tdb"],
): Promise<void> {
  const remaining = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });
  await Promise.all(
    remaining.map((stage, index) =>
      stage.position === index
        ? Promise.resolve(null)
        : tdb.updateById(stages, stage.id, { position: index }),
    ),
  );
}

/** Restores the English default stage set for a store with no stages yet. */
export async function seedDefaultStagesAction(): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb, store } = await requireOwner();
    const existing = await tdb.findMany(stages);
    if (existing.length > 0) {
      return { error: "This store already has stages." };
    }

    const { provisionStoreDefaults } = await import("@/lib/stores/provision");
    await provisionStoreDefaults(store.id);

    revalidateStages();
    return { ok: true, message: "Default stages restored." };
  });
}
