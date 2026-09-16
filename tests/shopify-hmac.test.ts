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

/**
 * The real callback carries `host`: base64 of `admin.shopify.com/store/<handle>`.
 * `admin.shopify.com/store/` is 24 characters, so whether that base64 ends in
 * `=` padding comes down to the handle length — and two thirds of handles
 * produce padding. `=` is the one character where "the decoded value" and "the
 * value on the wire" differ, so an implementation that picks the wrong one
 * passes every test written with a convenient shop name and then rejects most
 * real installs.
 *
 * These tests use a handle that produces padding, and sign the request each of
 * the ways Shopify's own tooling does.
 */
describe("OAuth HMAC with a real callback payload", () => {
  const PAYLOAD = {
    code: "0907a61c0c8d55e99db179b68161bc00",
    host: Buffer.from("admin.shopify.com/store/acme").toString("base64"),
    shop: "acme.myshopify.com",
    state: "809d527521643517539d8b689aa9c8b2",
    timestamp: "1700000000",
  };

  it("is a payload that actually exercises the encoding difference", () => {
    expect(PAYLOAD.host).toContain("=");
  });

  /** What Shopify's own SDK computes: decode, sort, re-encode. */
  function signReencoded(params: Record<string, string>): URLSearchParams {
    const ordered = Object.keys(params)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    const canonical = new URLSearchParams(ordered).toString();
    const hmac = createHmac("sha256", SECRET).update(canonical).digest("hex");
    return new URLSearchParams({ ...params, hmac });
  }

  /** Signing the encoded bytes as they travel on the wire. */
  function signRaw(params: Record<string, string>): {
    searchParams: URLSearchParams;
    rawQuery: string;
  } {
    const pairs = Object.keys(params)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(params[key])}`);
    const hmac = createHmac("sha256", SECRET)
      .update(pairs.join("&"))
      .digest("hex");
    const rawQuery = `?${pairs.join("&")}&hmac=${hmac}`;
    return { searchParams: new URLSearchParams(rawQuery), rawQuery };
  }

  it("accepts a callback signed the way Shopify's SDK signs it", () => {
    expect(
      verifyOAuthHmac({ searchParams: signReencoded(PAYLOAD), secret: SECRET }),
    ).toBe(true);
  });

  it("accepts a callback signed over the encoded wire bytes", () => {
    const { searchParams, rawQuery } = signRaw(PAYLOAD);
    expect(verifyOAuthHmac({ searchParams, secret: SECRET, rawQuery })).toBe(
      true,
    );
  });

  it("accepts the plain decoded join too", () => {
    const canonical = Object.keys(PAYLOAD)
      .sort()
      .map((key) => `${key}=${PAYLOAD[key as keyof typeof PAYLOAD]}`)
      .join("&");
    const hmac = createHmac("sha256", SECRET).update(canonical).digest("hex");
    expect(
      verifyOAuthHmac({
        searchParams: new URLSearchParams({ ...PAYLOAD, hmac }),
        secret: SECRET,
        rawQuery: undefined,
      }),
    ).toBe(true);
  });

  it("still rejects a tampered shop, whichever way it was signed", () => {
    const params = signReencoded(PAYLOAD);
    params.set("shop", "attacker.myshopify.com");
    expect(verifyOAuthHmac({ searchParams: params, secret: SECRET })).toBe(
      false,
    );

    const { searchParams, rawQuery } = signRaw(PAYLOAD);
    const tampered = rawQuery.replace("acme.myshopify.com", "evil.myshopify.com");
    expect(
      verifyOAuthHmac({
        searchParams: new URLSearchParams(tampered),
        secret: SECRET,
        rawQuery: tampered,
      }),
    ).toBe(false);
    expect(searchParams.get("shop")).toBe("acme.myshopify.com");
  });

  it("still rejects a signature made with a different secret", () => {
    const ordered = Object.keys(PAYLOAD)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = PAYLOAD[key as keyof typeof PAYLOAD];
        return acc;
      }, {});
    const hmac = createHmac("sha256", "not-the-secret")
      .update(new URLSearchParams(ordered).toString())
      .digest("hex");

    expect(
      verifyOAuthHmac({
        searchParams: new URLSearchParams({ ...PAYLOAD, hmac }),
        secret: SECRET,
      }),
    ).toBe(false);
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
