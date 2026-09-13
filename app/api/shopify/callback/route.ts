import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { issueInstallClaim } from "@/lib/auth/install-claim";
import { encryptSecret } from "@/lib/crypto/secrets";
import { db, storeMemberships, stores } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { ShopifyAdminClient } from "@/lib/shopify/admin-api";
import {
  isValidShopDomain,
  normalizeShopDomain,
  verifyOAuthHmac,
} from "@/lib/shopify/hmac";
import {
  OAUTH_STATE_COOKIE,
  exchangeCodeForToken,
  fetchShopProfile,
} from "@/lib/shopify/oauth";
import { registerWebhooks } from "@/lib/shopify/webhooks";
import { provisionStoreDefaults } from "@/lib/stores/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback.
 *
 * Order of checks matters: HMAC (is this really Shopify?), then state (did we
 * start this flow?), then the token exchange. Only after all three do we write
 * anything to the database.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const shopParam = params.get("shop");
  const code = params.get("code");

  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shopDomain || !isValidShopDomain(shopDomain) || !code) {
    return installError("The installation link was incomplete. Start again from your Shopify admin.");
  }

  if (!verifyOAuthHmac({ searchParams: params, secret: env.shopify.apiSecret })) {
    return installError("The installation request could not be verified.");
  }

  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const [expectedState, expectedShop] = (stateCookie ?? "").split(":");
  if (
    !expectedState ||
    expectedState !== params.get("state") ||
    expectedShop !== shopDomain
  ) {
    return installError("The installation session expired. Please try again.");
  }

  const { accessToken, scope } = await exchangeCodeForToken({ shopDomain, code });
  const client = ShopifyAdminClient.withToken(shopDomain, accessToken);

  // A failure here must not block the install; the store can still be used.
  const profile = await fetchShopProfile(client).catch(() => null);

  const [store] = await db
    .insert(stores)
    .values({
      shopDomain,
      name: profile?.name ?? null,
      primaryDomain: profile?.primaryDomain ?? null,
      currency: profile?.currency ?? "AUD",
      accessToken: encryptSecret(accessToken),
      scope,
      status: "active",
      installedAt: new Date(),
      uninstalledAt: null,
    })
    .onConflictDoUpdate({
      target: stores.shopDomain,
      set: {
        name: profile?.name ?? null,
        primaryDomain: profile?.primaryDomain ?? null,
        currency: profile?.currency ?? "AUD",
        accessToken: encryptSecret(accessToken),
        scope,
        status: "active",
        installedAt: new Date(),
        uninstalledAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Each store gets its own independent stages, branding, templates and rules.
  // Idempotent, so reinstalling never overwrites a live configuration.
  await provisionStoreDefaults(store.id);

  const registrations = await registerWebhooks(client).catch((error) => {
    console.error("[shopify] webhook registration failed", error);
    return [];
  });
  const failed = registrations.filter((entry) => entry.status === "failed");
  if (failed.length > 0) {
    console.error(
      "[shopify] some webhooks were not registered:",
      failed.map((entry) => `${entry.topic}: ${entry.message}`).join(" | "),
    );
  }

  // If the installer is already signed in and owns this store, go straight in.
  const user = await getCurrentUser();
  if (user) {
    const [membership] = await db
      .select()
      .from(storeMemberships)
      .where(
        and(
          eq(storeMemberships.userId, user.id),
          eq(storeMemberships.storeId, store.id),
          eq(storeMemberships.role, "owner"),
          eq(storeMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (membership) {
      const response = NextResponse.redirect(`${env.appUrl}/admin`);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }
  }

  // Otherwise hand the browser a signed, short-lived claim so it can create or
  // link the store's owner account.
  await issueInstallClaim(store.id);
  const response = NextResponse.redirect(`${env.appUrl}/claim`);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

function installError(message: string) {
  const url = new URL(`${env.appUrl}/install-failed`);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}
