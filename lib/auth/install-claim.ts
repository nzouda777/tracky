import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/lib/env";

export const INSTALL_CLAIM_COOKIE = "tracky.install_claim";
const TTL_MS = 30 * 60 * 1000;

/**
 * Short-lived proof that *this browser* just completed the Shopify OAuth flow
 * for a specific store.
 *
 * Completing OAuth requires Shopify admin rights on that shop, so the claim is
 * what lets the installer create the store's first owner account. It is signed
 * with the app secret and expires quickly, so it cannot be forged or replayed
 * to grab ownership of somebody else's store.
 */
function sign(payload: string): string {
  return createHmac("sha256", env.shopify.apiSecret)
    .update(payload)
    .digest("base64url");
}

export async function issueInstallClaim(storeId: string): Promise<void> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${storeId}.${expiresAt}`;
  const jar = await cookies();

  jar.set(INSTALL_CLAIM_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

/** Returns the claimed store id, or null when there is no valid claim. */
export async function readInstallClaim(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(INSTALL_CLAIM_COOKIE)?.value;
  if (!raw) return null;

  const [storeId, expiresAt, signature] = raw.split(".");
  if (!storeId || !expiresAt || !signature) return null;

  const expected = sign(`${storeId}.${expiresAt}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (Number(expiresAt) < Date.now()) return null;
  return storeId;
}

export async function clearInstallClaim(): Promise<void> {
  const jar = await cookies();
  jar.delete(INSTALL_CLAIM_COOKIE);
}
