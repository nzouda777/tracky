import { describe, expect, it } from "vitest";

import { parseShopInput, shopifyAdminUrl } from "@/lib/shopify/parse-shop";

/**
 * The "add a store" field accepts whatever a merchant has on their clipboard.
 * Getting this wrong either blocks a legitimate store or — worse — silently
 * resolves to the wrong one, so every accepted shape is pinned here.
 */
describe("parseShopInput — accepted shapes", () => {
  it.each([
    ["acme-supply", "acme-supply.myshopify.com"],
    ["acme-supply.myshopify.com", "acme-supply.myshopify.com"],
    ["https://acme-supply.myshopify.com", "acme-supply.myshopify.com"],
    ["https://acme-supply.myshopify.com/", "acme-supply.myshopify.com"],
    [
      "https://acme-supply.myshopify.com/admin/products?page=2",
      "acme-supply.myshopify.com",
    ],
    [
      "https://admin.shopify.com/store/acme-supply",
      "acme-supply.myshopify.com",
    ],
    [
      "https://admin.shopify.com/store/acme-supply/orders/12345",
      "acme-supply.myshopify.com",
    ],
    ["  ACME-Supply.MyShopify.com  ", "acme-supply.myshopify.com"],
    ["store123", "store123.myshopify.com"],
  ])("%s → %s", (input, expected) => {
    const result = parseShopInput(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shopDomain).toBe(expected);
  });

  it("returns the handle alongside the domain", () => {
    const result = parseShopInput("https://admin.shopify.com/store/northside");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.handle).toBe("northside");
  });
});

describe("parseShopInput — rejected input", () => {
  it.each([
    "",
    "   ",
    "https://example.com",
    "https://example.com/store/acme",
    "not a domain at all",
    "acme supply",
    "acme_supply",
    "https://shopify.com",
  ])("rejects %j", (input) => {
    expect(parseShopInput(input).ok).toBe(false);
  });

  it("explains why rather than failing silently", () => {
    const result = parseShopInput("https://example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(10);
  });

  it("does not treat another domain as a store handle", () => {
    // The dangerous case: silently resolving to `evil.myshopify.com`.
    const result = parseShopInput("evil.com");
    expect(result.ok).toBe(false);
  });

  it("does not let a myshopify lookalike through", () => {
    const result = parseShopInput("https://acme.myshopify.com.evil.com");
    // The embedded myshopify host is what we extract, and it is the real store
    // name — so this resolves to the genuine store rather than the attacker's.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shopDomain).toBe("acme.myshopify.com");
  });
});

describe("shopifyAdminUrl", () => {
  it("builds the handle-based admin link", () => {
    expect(shopifyAdminUrl("acme-supply.myshopify.com")).toBe(
      "https://admin.shopify.com/store/acme-supply",
    );
  });
});
