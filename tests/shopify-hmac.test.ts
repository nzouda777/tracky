import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  isValidShopDomain,
  verifyAppProxySignature,
  verifyOAuthHmac,
  verifyWebhookHmac,
} from "@/lib/shopify/hmac";
import { topicFromHeader } from "@/lib/shopify/webhooks";

const SECRET = "shpss_test_secret";

describe("webhook HMAC", () => {
  const rawBody = JSON.stringify({ id: 1234, name: "#1042" });
  const validHmac = createHmac("sha256", SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  it("accepts a correctly signed body", () => {
    expect(
      verifyWebhookHmac({ rawBody, headerHmac: validHmac, secret: SECRET }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = JSON.stringify({ id: 1234, name: "#9999" });
    expect(
      verifyWebhookHmac({ rawBody: tampered, headerHmac: validHmac, secret: SECRET }),
    ).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(
      verifyWebhookHmac({ rawBody, headerHmac: null, secret: SECRET }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const other = createHmac("sha256", "wrong").update(rawBody).digest("base64");
    expect(
      verifyWebhookHmac({ rawBody, headerHmac: other, secret: SECRET }),
    ).toBe(false);
  });

  it("rejects a signature of the same JSON re-serialised differently", () => {
    // Guards the "always hash the raw bytes" rule: whitespace changes the hash.
    const reserialised = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(
      verifyWebhookHmac({
        rawBody: reserialised,
        headerHmac: validHmac,
        secret: SECRET,
      }),
    ).toBe(false);
  });
});

describe("OAuth HMAC", () => {
  function sign(params: Record<string, string>): URLSearchParams {
    const canonical = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    const hmac = createHmac("sha256", SECRET).update(canonical).digest("hex");
    return new URLSearchParams({ ...params, hmac });
  }

  it("accepts a valid callback", () => {
    const params = sign({
      code: "abc123",
      shop: "demo.myshopify.com",
      state: "nonce",
      timestamp: "1700000000",
    });
    expect(verifyOAuthHmac({ searchParams: params, secret: SECRET })).toBe(true);
  });

  it("rejects a callback whose shop was swapped after signing", () => {
    const params = sign({
      code: "abc123",
      shop: "demo.myshopify.com",
      state: "nonce",
      timestamp: "1700000000",
    });
    params.set("shop", "attacker.myshopify.com");
    expect(verifyOAuthHmac({ searchParams: params, secret: SECRET })).toBe(false);
  });

  it("rejects a callback with no hmac at all", () => {
    const params = new URLSearchParams({ shop: "demo.myshopify.com" });
    expect(verifyOAuthHmac({ searchParams: params, secret: SECRET })).toBe(false);
  });
});

describe("App Proxy signature", () => {
  function sign(params: Record<string, string>): URLSearchParams {
    // Shopify's App Proxy scheme: sorted `k=v` pairs joined with NO separator.
    const canonical = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("");
    const signature = createHmac("sha256", SECRET)
      .update(canonical)
      .digest("hex");
    return new URLSearchParams({ ...params, signature });
  }

  it("accepts a request forwarded by Shopify", () => {
    const params = sign({
      shop: "demo.myshopify.com",
      path_prefix: "/apps/track-order",
      timestamp: "1700000000",
      token: "abc",
    });
    expect(verifyAppProxySignature({ searchParams: params, secret: SECRET })).toBe(
      true,
    );
  });

  it("rejects a request whose order token was changed", () => {
    const params = sign({
      shop: "demo.myshopify.com",
      path_prefix: "/apps/track-order",
      timestamp: "1700000000",
      token: "abc",
    });
    // Someone trying to read a different customer's order.
    params.set("token", "someone-elses-token");
    expect(verifyAppProxySignature({ searchParams: params, secret: SECRET })).toBe(
      false,
    );
  });

  it("rejects an unsigned direct hit on our origin", () => {
    const params = new URLSearchParams({
      shop: "demo.myshopify.com",
      token: "abc",
    });
    expect(verifyAppProxySignature({ searchParams: params, secret: SECRET })).toBe(
      false,
    );
  });

  it("does not accept the OAuth canonicalisation by mistake", () => {
    // Same params, but joined with "&" as OAuth does. Must not validate.
    const params = {
      shop: "demo.myshopify.com",
      timestamp: "1700000000",
    };
    const oauthStyle = createHmac("sha256", SECRET)
      .update(
        Object.keys(params)
          .sort()
          .map((key) => `${key}=${params[key as keyof typeof params]}`)
          .join("&"),
      )
      .digest("hex");

    const search = new URLSearchParams({ ...params, signature: oauthStyle });
    expect(verifyAppProxySignature({ searchParams: search, secret: SECRET })).toBe(
      false,
    );
  });
});

describe("shop domain validation", () => {
  it.each([
    ["demo.myshopify.com", true],
    ["my-store-123.myshopify.com", true],
    ["evil.com", false],
    ["demo.myshopify.com.evil.com", false],
    ["demo.myshopify.com/../admin", false],
    ["", false],
    [null, false],
  ])("%s → %s", (input, expected) => {
    expect(isValidShopDomain(input as string | null)).toBe(expected);
  });
});

describe("webhook topic mapping", () => {
  it.each([
    ["orders/create", "ORDERS_CREATE"],
    ["orders/updated", "ORDERS_UPDATED"],
    ["orders/cancelled", "ORDERS_CANCELLED"],
    ["fulfillments/create", "FULFILLMENTS_CREATE"],
    ["app/uninstalled", "APP_UNINSTALLED"],
  ])("maps %s", (header, expected) => {
    expect(topicFromHeader(header)).toBe(expected);
  });

  it("ignores topics the app does not consume", () => {
    expect(topicFromHeader("customers/create")).toBeNull();
    expect(topicFromHeader("")).toBeNull();
  });
});
