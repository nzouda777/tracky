import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import type { ShopifyCredentials } from "./credentials";
import { ShopifyApiError, ShopifyAdminClient } from "./admin-api";

export const OAUTH_STATE_COOKIE = "tracky.oauth_state";

export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * The URL the merchant is sent to in order to grant access.
 *
 * The client id and scopes come from the credentials of the Shopify app *this
 * store* is being connected through, so different stores can be installed from
 * different apps. The redirect URI is deliberately the same for every app —
 * one string to whitelist in each app's configuration rather than one per
 * store — because the callback identifies the app from the shop domain.
 */
export function buildAuthorizeUrl({
  shopDomain,
  state,
  credentials,
}: {
  shopDomain: string;
  state: string;
  credentials: ShopifyCredentials;
}): string {
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", credentials.apiKey);
  url.searchParams.set("scope", credentials.scopes);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", state);
  return url.toString();
}

/** The single OAuth redirect URI, shared by every app the platform holds. */
export function callbackUrl(): string {
  return `${env.appUrl}/api/shopify/callback`;
}

export type TokenExchangeResult = {
  accessToken: string;
  scope: string;
};

/** Exchanges the one-time `code` for a permanent Admin API access token. */
export async function exchangeCodeForToken({
  shopDomain,
  code,
  credentials,
}: {
  shopDomain: string;
  code: string;
  credentials: ShopifyCredentials;
}): Promise<TokenExchangeResult> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: credentials.apiKey,
      client_secret: credentials.apiSecret,
      code,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify token exchange failed with ${response.status}.`,
      response.status,
      await response.text(),
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };

  if (!payload.access_token) {
    throw new ShopifyApiError("Shopify token exchange returned no token.");
  }

  return { accessToken: payload.access_token, scope: payload.scope ?? "" };
}

export type ShopProfile = {
  name: string | null;
  currency: string | null;
  email: string | null;
  /** Customer-facing host, e.g. `northside-supply.com`. */
  primaryDomain: string | null;
};

/** Shop metadata used to seed the store row after installation. */
export async function fetchShopProfile(
  client: ShopifyAdminClient,
): Promise<ShopProfile> {
  const data = await client.graphql<{
    shop: {
      name: string;
      email: string | null;
      currencyCode: string | null;
      primaryDomain: { host: string } | null;
    };
  }>(`
    query ShopProfile {
      shop {
        name
        email
        currencyCode
        primaryDomain { host }
      }
    }
  `);

  return {
    name: data.shop.name ?? null,
    currency: data.shop.currencyCode ?? null,
    email: data.shop.email ?? null,
    primaryDomain: data.shop.primaryDomain?.host ?? null,
  };
}
