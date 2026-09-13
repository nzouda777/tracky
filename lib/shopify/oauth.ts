import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import { ShopifyApiError, ShopifyAdminClient } from "./admin-api";

export const OAUTH_STATE_COOKIE = "tracky.oauth_state";

export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** The URL the merchant is sent to in order to grant access. */
export function buildAuthorizeUrl({
  shopDomain,
  state,
}: {
  shopDomain: string;
  state: string;
}): string {
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.shopify.apiKey);
  url.searchParams.set("scope", env.shopify.scopes);
  url.searchParams.set("redirect_uri", `${env.appUrl}/api/shopify/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

export type TokenExchangeResult = {
  accessToken: string;
  scope: string;
};

/** Exchanges the one-time `code` for a permanent Admin API access token. */
export async function exchangeCodeForToken({
  shopDomain,
  code,
}: {
  shopDomain: string;
  code: string;
}): Promise<TokenExchangeResult> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.shopify.apiKey,
      client_secret: env.shopify.apiSecret,
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
