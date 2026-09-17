import { eq } from "drizzle-orm";

import type { ActionResult } from "@/lib/actions/result";
import { encryptSecret } from "@/lib/crypto/secrets";
import { db, stores, type Store } from "@/lib/db";
import { ShopifyAdminClient } from "@/lib/shopify/admin-api";
import {
  credentialColumns,
  type CredentialInput,
} from "@/lib/shopify/credentials";
import { fetchShopProfile } from "@/lib/shopify/oauth";

/**
 * Deliberately NOT in `lib/actions/`.
 *
 * Every exported function in a `"use server"` module is a callable endpoint,
 * and this one takes the store to write to as an argument rather than deriving
 * it from the caller's session — exported from there it would let anyone point
 * it at any store and replace the secret its webhooks are verified against.
 * It lives here so the only ways in are the two actions that guard first: the
 * owner's, through `requireStoreById`, and the operator's, through
 * `requirePlatformAdmin`.
 */

/**
 * Writes a new set of credentials onto an existing store, verifying first.
 *
 * Shared by the owner-facing action above and the platform operator's, so both
 * paths apply the same rule: a token is proven against Shopify before it
 * replaces a working one.
 */
export async function writeStoreCredentials(
  store: Store,
  input: CredentialInput,
): Promise<ActionResult> {
  if (input.authMode === "custom" && input.accessToken) {
    const client = ShopifyAdminClient.withToken(
      store.shopDomain,
      input.accessToken,
      input.apiVersion,
    );
    const profile = await fetchShopProfile(client).catch(() => null);
    if (!profile) {
      return {
        fieldErrors: {
          accessToken:
            "Shopify refused that token for this store. Nothing was changed.",
        },
      };
    }
  }

  const reconnected =
    input.authMode === "custom" && input.accessToken
      ? {
          accessToken: encryptSecret(input.accessToken),
          status: "active" as const,
          installedAt: store.installedAt ?? new Date(),
          uninstalledAt: null,
        }
      : {};

  await db
    .update(stores)
    .set({
      authMode: input.authMode,
      ...credentialColumns(input),
      // An OAuth store keeps its existing token: the secret key only verifies
      // signatures, so rotating it must not disconnect the store.
      ...reconnected,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  return {
    ok: true,
    message:
      input.authMode === "custom"
        ? "The app credentials were updated and the new token was accepted by Shopify."
        : "The app credentials were updated. Reconnect the store so Shopify issues a token for the new app.",
  };
}
