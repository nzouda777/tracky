import { describe, expect, it } from "vitest";

import { parseNextPageInfo } from "@/lib/shopify/admin-api";

/**
 * Shopify paginates REST collections through the `Link` header, not the body.
 * Reading it wrong means the order sync silently stops after the first 50
 * orders while reporting success — the kind of bug nobody notices until a
 * merchant says orders are missing.
 */
describe("parseNextPageInfo", () => {
  it("extracts the cursor from a next link", () => {
    const header =
      '<https://shop.myshopify.com/admin/api/2025-07/orders.json?limit=50&page_info=abc123>; rel="next"';
    expect(parseNextPageInfo(header)).toBe("abc123");
  });

  it("picks next, not previous, when both are present", () => {
    const header = [
      '<https://shop.myshopify.com/admin/api/2025-07/orders.json?page_info=PREV>; rel="previous"',
      '<https://shop.myshopify.com/admin/api/2025-07/orders.json?page_info=NEXT>; rel="next"',
    ].join(", ");
    expect(parseNextPageInfo(header)).toBe("NEXT");
  });

  it("returns null on the last page, which has only a previous link", () => {
    const header =
      '<https://shop.myshopify.com/admin/api/2025-07/orders.json?page_info=PREV>; rel="previous"';
    expect(parseNextPageInfo(header)).toBeNull();
  });

  it("returns null when there is no header at all", () => {
    expect(parseNextPageInfo(null)).toBeNull();
    expect(parseNextPageInfo("")).toBeNull();
  });

  it("tolerates unquoted rel values", () => {
    const header =
      "<https://shop.myshopify.com/admin/api/2025-07/orders.json?page_info=xyz>; rel=next";
    expect(parseNextPageInfo(header)).toBe("xyz");
  });

  it("returns null rather than throwing on a malformed link", () => {
    expect(parseNextPageInfo('<not a url>; rel="next"')).toBeNull();
  });
});
