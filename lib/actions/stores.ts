"use server";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getMemberships,
  requireStoreById,
  requireUser,
  setActiveStore,
} from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { db, orders, stores, storeMemberships, type Store } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { ShopifyAdminClient } from "@/lib/shopify/admin-api";
import {
  credentialColumns,
  environmentCredentials,
  parseCredentialInput,
  type CredentialInput,
} from "@/lib/shopify/credentials";
import { fetchShopProfile } from "@/lib/shopify/oauth";
import { writeStoreCredentials } from "@/lib/stores/credentials";
import { parseShopInput } from "@/lib/shopify/parse-shop";
import { registerWebhooks } from "@/lib/shopify/webhooks";
import { provisionStoreDefaults } from "@/lib/stores/provision";
import { guard, type ActionResult } from "./result";

/**
 * Adding a store from the backoffice, with the Shopify app it runs on.
 *
 * The platform holds many Shopify apps, not one. A public app is capped in how
 * widely it can be installed, so spreading across stores means spreading
 * across apps — and the app a store belongs to is therefore part of adding it,
 * alongside the domain. Two shapes of app are accepted:
 *
 *   oauth  — an app from the Partner dashboard. We take its Client ID and
 *            secret, then hand off to the very same `/api/shopify/install`
 *            route Shopify itself uses, so OAuth, HMAC verification, token
 *            encryption, default provisioning and webhook registration are
 *            unchanged. The token is minted by the merchant's approval.
 *   custom — an app created inside the store under *Develop apps*. There is no
 *            installation flow at all: the Admin API token is pasted in, and
 *            the store is connected here and now.
 */
export async function connectStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    // Any signed-in user may start an install; ownership of the resulting store
    // is granted by the OAuth callback, which requires Shopify admin rights.
    const user = await requireUser();

    const parsed = parseShopInput(String(formData.get("shop") ?? ""));
    if (!parsed.ok) {
      return { fieldErrors: { shop: parsed.reason } };
    }
    const shopDomain = parsed.shopDomain;

    const credentials = parseCredentialInput(formData, {
      // Blank credentials are only meaningful while a platform-wide app is
      // still configured; otherwise they are simply missing.
      allowPlatformFallback: env.shopify.fallbackConfigured,
    });
    if (!credentials.ok) {
      return { fieldErrors: credentials.fieldErrors };
    }

    const [existing] = await db
      .select()
      .from(stores)
      .where(eq(stores.shopDomain, shopDomain))
      .limit(1);

    // Who is allowed to write app credentials onto this shop? A new shop and a
    // half-finished one are open; an already connected one is not, because its
    // secret is what every webhook and App Proxy request for that store is
    // verified against — handing it to a passer-by would let them forge both.
    //
    // Membership is read directly rather than through `getMemberships`, which
    // only returns stores that are active and unsuspended: the owner of a store
    // Shopify was uninstalled from is exactly who needs to put it on a
    // different app before reinstalling it.
    const isOwner = existing
      ? (
          await db
            .select({ id: storeMemberships.id })
            .from(storeMemberships)
            .where(
              and(
                eq(storeMemberships.userId, user.id),
                eq(storeMemberships.storeId, existing.id),
                eq(storeMemberships.role, "owner"),
                eq(storeMemberships.status, "active"),
              ),
            )
            .limit(1)
        ).length > 0
      : false;
    const mayWriteCredentials =
      !existing || existing.status === "pending" || isOwner;

    if (existing?.status === "active" && isOwner) {
      return {
        error: `${shopDomain} is already connected. Use the store switcher to open it, or update its app keys from this page.`,
      };
    }

    if (credentials.value.authMode === "custom") {
      return connectCustomApp({
        shopDomain,
        userId: user.id,
        input: credentials.value,
        existing: existing ?? null,
        mayWriteCredentials,
      });
    }

    // --- OAuth app --------------------------------------------------------
    // The credentials are written first, in a `pending` row, because the two
    // requests that come next — Shopify's call to our install route, then its
    // OAuth callback — arrive naming only the shop domain. That row is how
    // either one finds out which app to use, and which secret verifies it.
    if (mayWriteCredentials && credentials.value.apiKey) {
      const columns = {
        authMode: "oauth" as const,
        ...credentialColumns(credentials.value),
      };

      await db
        .insert(stores)
        .values({ shopDomain, status: "pending", ...columns })
        .onConflictDoUpdate({
          target: stores.shopDomain,
          set: { ...columns, updatedAt: new Date() },
        });
    } else if (!existing && !environmentCredentials()) {
      return {
        fieldErrors: {
          apiKey:
            "Enter the Shopify app's Client ID and secret to connect this store.",
        },
      };
    }

    redirect(`/api/shopify/install?shop=${encodeURIComponent(shopDomain)}`);
  });
}

/**
 * Connects a store through an app created in its own Shopify admin.
 *
 * No OAuth, so nothing here proves the person holds admin rights on the shop —
 * except that they are holding an Admin API token for it, which is issued only
 * inside that shop's admin. That token *is* the proof, so it is checked against
 * Shopify before anything is written: a store is never created on the strength
 * of an unverified paste.
 */
async function connectCustomApp({
  shopDomain,
  userId,
  input,
  existing,
  mayWriteCredentials,
}: {
  shopDomain: string;
  userId: string;
  input: CredentialInput;
  existing: Store | null;
  mayWriteCredentials: boolean;
}): Promise<ActionResult> {
  if (existing && !mayWriteCredentials) {
    return {
      error: `${shopDomain} is already connected to another account. Ask its owner to add you, or reinstall it from your Shopify admin.`,
    };
  }

  const client = ShopifyAdminClient.withToken(
    shopDomain,
    input.accessToken,
    input.apiVersion,
  );

  const profile = await fetchShopProfile(client).catch((error: unknown) => {
    console.error("[shopify] custom app token rejected", {
      shop: shopDomain,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!profile) {
    return {
      fieldErrors: {
        accessToken:
          "Shopify refused that token for this store. Check it was copied from this shop's own app, that the app is installed, and that it has read_orders and write_fulfillments access.",
      },
    };
  }

  const columns = {
    authMode: "custom" as const,
    ...credentialColumns(input),
  };

  const [store] = await db
    .insert(stores)
    .values({
      shopDomain,
      name: profile.name,
      primaryDomain: profile.primaryDomain,
      currency: profile.currency ?? "AUD",
      accessToken: encryptSecret(input.accessToken),
      scope: input.scopes,
      status: "active",
      installedAt: new Date(),
      uninstalledAt: null,
      ...columns,
    })
    .onConflictDoUpdate({
      target: stores.shopDomain,
      set: {
        name: profile.name,
        primaryDomain: profile.primaryDomain,
        currency: profile.currency ?? "AUD",
        accessToken: encryptSecret(input.accessToken),
        scope: input.scopes,
        status: "active",
        installedAt: new Date(),
        uninstalledAt: null,
        updatedAt: new Date(),
        ...columns,
      },
    })
    .returning();

  // Same independent starting configuration every store gets. Idempotent, so
  // re-pasting a rotated token never touches a live setup.
  await provisionStoreDefaults(store.id);

  await db
    .insert(storeMemberships)
    .values({
      storeId: store.id,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [storeMemberships.storeId, storeMemberships.userId],
      set: { role: "owner", status: "active", updatedAt: new Date() },
    });

  // Best effort: a store with no webhooks still works through "Sync orders",
  // so a registration failure is reported rather than fatal.
  const registrations = await registerWebhooks(client).catch(() => null);
  const failed =
    registrations?.filter((entry) => entry.status === "failed") ?? [];

  await setActiveStore(store.id);
  revalidatePath("/admin/stores");

  if (!registrations || failed.length > 0) {
    const detail =
      failed.length > 0
        ? `: ${failed.map((entry) => entry.message).join("; ")}`
        : "";
    return {
      ok: true,
      message: `${profile.name ?? shopDomain} is connected, but its order webhooks could not all be registered${detail}. New orders may not arrive until that is fixed — check the app's scopes in your Shopify admin.`,
    };
  }

  redirect("/admin");
}

/**
 * Replaces the Shopify app credentials a store runs on, for an owner.
 *
 * Rotating a leaked secret, or moving a store onto a different app because the
 * current one is at its install ceiling. The access token is only replaced when
 * a new one is given, so rotating just the secret key does not disconnect the
 * store.
 */
export async function updateStoreCredentialsAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const storeId = String(formData.get("storeId") ?? "");
    const session = await requireStoreById(storeId, ["owner"]);

    const parsed = parseCredentialInput(formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const result = await writeStoreCredentials(session.store, parsed.value);
    if (!result.ok) return result;

    revalidatePath("/admin/stores");
    return result;
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
