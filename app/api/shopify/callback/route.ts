import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { issueInstallClaim } from "@/lib/auth/install-claim";
import { encryptSecret } from "@/lib/crypto/secrets";
import { db, storeMemberships, stores } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { ShopifyAdminClient } from "@/lib/shopify/admin-api";
import { credentialColumns, resolveShop } from "@/lib/shopify/credentials";
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
  try {
    return await handleCallback(request);
  } catch (error) {
    // Anything thrown past here used to surface as a blank 500 with the reason
    // only in a server log nobody was reading, which makes a failed install
    // impossible to diagnose from the outside. Say what happened.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shopify] install failed", {
      shop: request.nextUrl.searchParams.get("shop"),
      message,
      error,
    });
    return installError(message);
  }
}

async function handleCallback(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const shopParam = params.get("shop");
  const code = params.get("code");

  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shopDomain || !isValidShopDomain(shopDomain) || !code) {
    return installError("The installation link was incomplete. Start again from your Shopify admin.");
  }

  // Which Shopify app is this install for? The shop domain answers it: its
  // store row was created with that app's credentials when it was added. The
  // domain is unverified at this point, but it only picks the secret the
  // signature below is checked against — a wrong pick fails that check.
  const { credentials } = await resolveShop(shopDomain);

  if (!credentials) {
    return installError(
      `No Shopify app credentials are configured for ${shopDomain}. Add the store with its app's API key and secret key, then install it again.`,
    );
  }

  if (
    !verifyOAuthHmac({
      searchParams: params,
      secret: credentials.apiSecret,
      rawQuery: request.nextUrl.search,
    })
  ) {
    console.error("[shopify] OAuth HMAC rejected", {
      shop: shopDomain,
      params: [...params.keys()].sort().join(","),
    });
    return installError(
      `The installation request could not be verified. This usually means the API secret key stored for ${shopDomain} does not match the app it is being installed from.`,
    );
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

  const { accessToken, scope } = await exchangeCodeForToken({
    shopDomain,
    code,
    credentials,
  });
  const client = ShopifyAdminClient.withToken(
    shopDomain,
    accessToken,
    credentials.apiVersion,
  );

  // A failure here must not block the install; the store can still be used.
  // It is logged rather than swallowed, because a profile that never loads
  // usually means the granted scopes are not what the app asked for.
  const profile = await fetchShopProfile(client).catch((error: unknown) => {
    console.error("[shopify] could not read the shop profile", {
      shop: shopDomain,
      scope,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  // Only overwrite the shop's details when we actually read them. A reinstall
  // whose profile call failed must not blank the name and currency an existing
  // store has been running on.
  const profileFields = profile
    ? {
        name: profile.name,
        primaryDomain: profile.primaryDomain,
        currency: profile.currency ?? "AUD",
      }
    : {};

  // The credentials just completed a real OAuth round trip against this shop,
  // so they are written onto the row whichever way they were resolved. A store
  // that had been running on the environment fallback becomes self-describing
  // from here on, and no longer depends on a platform-wide variable.
  const appColumns = {
    authMode: "oauth" as const,
    ...credentialColumns({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      scopes: credentials.scopes,
      apiVersion: credentials.apiVersion,
    }),
  };

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
      ...appColumns,
    })
    .onConflictDoUpdate({
      target: stores.shopDomain,
      set: {
        ...profileFields,
        accessToken: encryptSecret(accessToken),
        scope,
        status: "active",
        installedAt: new Date(),
        uninstalledAt: null,
        updatedAt: new Date(),
        ...appColumns,
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
