"use server";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getMemberships, requireStoreById, requireUser } from "@/lib/auth/session";
import { db, orders, stores, storeMemberships, type Store } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { parseShopInput } from "@/lib/shopify/parse-shop";
import { guard, type ActionResult } from "./result";

/**
 * Starting an installation from the backoffice.
 *
 * This is a shortcut, not a second code path: it normalises whatever was pasted
 * and then hands off to the very same `/api/shopify/install` route Shopify
 * itself uses, so OAuth, HMAC verification, token encryption, default
 * provisioning and webhook registration are unchanged.
 */
export async function connectStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    // Any signed-in user may start an install; ownership of the resulting store
    // is granted by the OAuth callback, which requires Shopify admin rights.
    await requireUser();

    const parsed = parseShopInput(String(formData.get("shop") ?? ""));
    if (!parsed.ok) {
      return { fieldErrors: { shop: parsed.reason } };
    }

    // Already connected and active? Say so instead of bouncing the user
    // through an OAuth round trip that changes nothing.
    const [existing] = await db
      .select()
      .from(stores)
      .where(eq(stores.shopDomain, parsed.shopDomain))
      .limit(1);

    if (existing?.status === "active") {
      const memberships = await getMemberships((await requireUser()).id);
      const isMember = memberships.some((m) => m.store.id === existing.id);

      if (isMember) {
        return {
          error: `${parsed.shopDomain} is already connected. Use the store switcher to open it.`,
        };
      }
      // Connected, but this user has no access: reinstalling is the sanctioned
      // way to claim it, and it requires Shopify admin rights on that store.
    }

    redirect(`/api/shopify/install?shop=${encodeURIComponent(parsed.shopDomain)}`);
  });
}

/**
 * Reconnects a store whose token was revoked or whose scopes changed.
 * Same install route, same guarantees.
 */
export async function reconnectStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const storeId = String(formData.get("storeId") ?? "");
    // Only an owner of that specific store may reconnect it.
    const session = await requireStoreById(storeId, ["owner"]);

    redirect(
      `/api/shopify/install?shop=${encodeURIComponent(session.store.shopDomain)}`,
    );
  });
}

// ---------------------------------------------------------------------------
// Read model for the Stores screen
// ---------------------------------------------------------------------------

export type StoreRow = {
  store: Store;
  role: "owner" | "agency";
  totalOrders: number;
  activeOrders: number;
  lastOrderAt: Date | null;
  isActiveStore: boolean;
};

/**
 * Every store this user can act on, with enough signal to tell a healthy
 * connection from a broken one.
 *
 * Each store's counts are read through its own tenant scope, so this overview
 * cannot become the one place where store data leaks across a boundary.
 */
export async function listMyStores(activeStoreId: string): Promise<StoreRow[]> {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);

  return Promise.all(
    memberships.map(async ({ store, membership }) => {
      // One tenant client per store rather than a hand-written `store_id`
      // predicate: this screen lists several stores at once, which is exactly
      // the situation where a copy-pasted filter eventually points at the
      // wrong id.
      const tdb = new TenantDb(store.id);

      const [totals] = await tdb.raw
        .select({ value: count() })
        .from(orders)
        .where(tdb.scope(orders));

      const [active] = await tdb.raw
        .select({ value: count() })
        .from(orders)
        .where(tdb.scope(orders, isNull(orders.cancelledAt)));

      const [latest] = await tdb.raw
        .select({ orderDate: orders.orderDate })
        .from(orders)
        .where(tdb.scope(orders))
        .orderBy(desc(orders.orderDate))
        .limit(1);

      return {
        store,
        role: membership.role,
        totalOrders: Number(totals?.value ?? 0),
        activeOrders: Number(active?.value ?? 0),
        lastOrderAt: latest?.orderDate ?? null,
        isActiveStore: store.id === activeStoreId,
      };
    }),
  );
}

/**
 * Stores this user is a member of that are no longer connected — the app was
 * uninstalled from Shopify, so the token is gone and nothing will sync.
 */
export async function listDisconnectedStores(): Promise<Store[]> {
  const user = await requireUser();

  const rows = await db
    .select({ store: stores })
    .from(storeMemberships)
    .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
    .where(
      and(
        eq(storeMemberships.userId, user.id),
        eq(storeMemberships.status, "active"),
        eq(stores.status, "uninstalled"),
      ),
    );

  return rows.map((row) => row.store);
}
