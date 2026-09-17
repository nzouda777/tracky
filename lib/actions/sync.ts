"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import { db, stores } from "@/lib/db";
import { syncOrdersFromShopify } from "@/lib/shopify/sync";
import { guard, type ActionResult } from "./result";

/**
 * "Sync orders" — pulls recent orders from the Shopify Admin API.
 *
 * Webhooks stay the primary path; this is the recovery lever for the cases
 * they cannot cover (orders predating the install, a missed delivery, a store
 * reconnected after being uninstalled).
 */
export async function syncOrdersAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { store, user } = await requireOwner();

    const sinceDays = clampDays(formData.get("sinceDays"));

    // Re-read the store so the access token is the current one, not whatever
    // the session was built with.
    const [fresh] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, store.id))
      .limit(1);

    if (!fresh) return { error: "That store no longer exists." };
    if (fresh.status !== "active") {
      return {
        error:
          "This store is disconnected from Shopify. Reconnect it from the Stores page first.",
      };
    }

    const result = await syncOrdersFromShopify({
      store: fresh,
      options: { sinceDays, userId: user.id },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/agency");

    if (result.examined === 0 && result.problems.length > 0) {
      return { error: result.problems.join(" ") };
    }

    // Shopify returned nothing at all for the window. Say so in those terms:
    // "no new orders" reads as "the sync found nothing to do", when in fact
    // the store may be full of orders that simply predate the window.
    if (result.examined === 0) {
      return {
        ok: true,
        message:
          sinceDays >= 60
            ? "Shopify returned no orders created in the last 60 days, which is as far back as it will go without the protected read_all_orders scope."
            : `Shopify returned no orders created in the last ${sinceDays} days. Try a longer window — Shopify will go back 60 days.`,
      };
    }

    const parts: string[] = [];
    parts.push(
      result.imported === 0
        ? "No new orders found"
        : `Imported ${result.imported} new order${result.imported === 1 ? "" : "s"}`,
    );
    if (result.updated > 0) {
      parts.push(`refreshed ${result.updated}`);
    }
    if (result.emailsScheduled > 0) {
      parts.push(
        `scheduled ${result.emailsScheduled} email${result.emailsScheduled === 1 ? "" : "s"}`,
      );
    }
    parts.push(
      `checked ${result.examined} order${result.examined === 1 ? "" : "s"} from the last ${sinceDays} days`,
    );

    let message = `${parts.join(", ")}.`;
    if (result.truncated) {
      message +=
        " Shopify had more orders than one run can pull — sync again to continue.";
    }
    if (result.problems.length > 0) {
      message += ` Some orders had problems: ${result.problems.slice(0, 3).join("; ")}`;
    }

    return { ok: true, message };
  });
}

/** Shopify will not return unscoped orders older than 60 days. */
function clampDays(value: FormDataEntryValue | null): number {
  const days = Number(value);
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(Math.round(days), 1), 60);
}
