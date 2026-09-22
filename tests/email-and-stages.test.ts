import { beforeAll, describe, expect, it } from "vitest";

import {
  applyMergeFields,
  buildMergeContext,
  findUnknownMergeTokens,
  MERGE_VARIABLES,
  sampleMergeContext,
} from "@/lib/email/merge";
import { buildTimeline, isAddressEditable } from "@/lib/orders/stages";
import { mapOrderPayload } from "@/lib/shopify/orders";
import type { Stage } from "@/lib/db";

function stage(overrides: Partial<Stage> & { id: string; position: number }): Stage {
  return {
    storeId: "store",
    key: overrides.id,
    name: overrides.id,
    description: "",
    icon: "circle",
    color: "#000000",
    isTerminal: false,
    triggersFulfillment: false,
    locksAddressEditing: false,
    advancesOnPayment: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const STAGES = [
  stage({ id: "placed", position: 0 }),
  stage({ id: "processing", position: 1 }),
  stage({ id: "out", position: 2, locksAddressEditing: true }),
  stage({ id: "delivered", position: 3, isTerminal: true, triggersFulfillment: true }),
];

// ---------------------------------------------------------------------------

describe("merge fields", () => {
  const context = sampleMergeContext("Northside Supply");

  it("replaces every documented variable", () => {
    for (const variable of MERGE_VARIABLES) {
      const output = applyMergeFields(`{{${variable.token}}}`, context);
      expect(output).not.toContain("{{");
    }
  });

  it("tolerates whitespace and case inside the braces", () => {
    expect(applyMergeFields("{{ ORDER_NUMBER }}", context)).toBe(
      context.order_number,
    );
  });

  it("leaves an unknown variable visible instead of silently dropping it", () => {
    expect(applyMergeFields("Hi {{first_name}}", context)).toBe(
      "Hi {{first_name}}",
    );
    expect(findUnknownMergeTokens("Hi {{first_name}}")).toEqual(["first_name"]);
  });

  it("escapes HTML in merged values so a customer name cannot inject markup", () => {
    const hostile = buildMergeContext({
      order: {
        orderNumber: "#1",
        orderDate: new Date("2025-10-05T00:00:00Z"),
        customerName: '<script>alert("x")</script>',
        shippingAddress: null,
      },
      store: { name: "Shop", shopDomain: "shop.myshopify.com" },
      stage: null,
      trackingLink: "https://shop.com/apps/track-order?token=a&b=c",
    });

    const html = applyMergeFields("<p>Hi {{customer_name}}</p>", hostile);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not escape the subject line, which is plain text", () => {
    const output = applyMergeFields("Order {{order_number}} & you", context, {
      escape: false,
    });
    expect(output).toContain("&");
    expect(output).not.toContain("&amp;");
  });

  it("escapes ampersands inside a tracking URL, which is valid in href", () => {
    const withUrl = buildMergeContext({
      order: {
        orderNumber: "#1",
        orderDate: new Date(),
        customerName: "Sam",
        shippingAddress: null,
      },
      store: { name: "Shop", shopDomain: "shop.myshopify.com" },
      stage: null,
      trackingLink: "https://shop.com/apps/track-order?token=a&x=1",
    });

    const html = applyMergeFields('<a href="{{tracking_link}}">Track</a>', withUrl);
    expect(html).toContain("token=a&amp;x=1");
  });

  it("falls back to a friendly greeting when there is no customer name", () => {
    const context = buildMergeContext({
      order: {
        orderNumber: "#1",
        orderDate: new Date(),
        customerName: null,
        shippingAddress: null,
      },
      store: { name: null, shopDomain: "shop.myshopify.com" },
      stage: null,
      trackingLink: "https://example.com",
    });

    expect(context.customer_name).toBe("there");
    expect(context.store_name).toBe("shop.myshopify.com");
  });
});

// ---------------------------------------------------------------------------

describe("timeline", () => {
  it("marks past stages complete, the current one current, the rest upcoming", () => {
    const timeline = buildTimeline(STAGES, "out");
    expect(timeline.map((entry) => entry.state)).toEqual([
      "complete",
      "complete",
      "current",
      "upcoming",
    ]);
  });

  it("shows nothing as reached when the order has no stage yet", () => {
    const timeline = buildTimeline(STAGES, null);
    expect(timeline.every((entry) => entry.state === "upcoming")).toBe(true);
  });

  it("does not mark anything complete for an unknown stage id", () => {
    const timeline = buildTimeline(STAGES, "does-not-exist");
    expect(timeline.every((entry) => entry.state === "upcoming")).toBe(true);
  });
});

describe("address editing lock", () => {
  it("is open before the locking stage", () => {
    expect(
      isAddressEditable({
        allStages: STAGES,
        currentStageId: "processing",
        allowedByBranding: true,
      }),
    ).toBe(true);
  });

  it("closes as soon as the locking stage is reached", () => {
    expect(
      isAddressEditable({
        allStages: STAGES,
        currentStageId: "out",
        allowedByBranding: true,
      }),
    ).toBe(false);
  });

  it("stays closed after the locking stage", () => {
    expect(
      isAddressEditable({
        allStages: STAGES,
        currentStageId: "delivered",
        allowedByBranding: true,
      }),
    ).toBe(false);
  });

  it("respects the store turning address editing off entirely", () => {
    expect(
      isAddressEditable({
        allStages: STAGES,
        currentStageId: "placed",
        allowedByBranding: false,
      }),
    ).toBe(false);
  });

  it("stays open when no stage locks the address", () => {
    const noLock = STAGES.map((entry) => ({
      ...entry,
      locksAddressEditing: false,
    advancesOnPayment: false,
    }));
    expect(
      isAddressEditable({
        allStages: noLock,
        currentStageId: "delivered",
        allowedByBranding: true,
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Shopify order mapping", () => {
  it("maps a typical orders/create payload", () => {
    const mapped = mapOrderPayload({
      id: 5544332211,
      name: "#1042",
      email: "Sarah@Example.COM",
      created_at: "2025-10-05T04:15:00+11:00",
      currency: "AUD",
      total_price: "327.00",
      customer: { first_name: "Sarah", last_name: "Jenkins" },
      shipping_address: {
        address1: "12 Bourke Street",
        city: "Melbourne",
        province: "Victoria",
        province_code: "VIC",
        zip: "3000",
        country: "Australia",
        country_code: "AU",
      },
      line_items: [
        { id: 1, title: "Cedar Side Table", quantity: 1, price: "249.00" },
        { id: 2, title: "Cushion", quantity: 2, price: "39.00", variant_title: "Sand" },
      ],
    });

    expect(mapped.shopifyOrderId).toBe("5544332211");
    expect(mapped.orderNumber).toBe("#1042");
    expect(mapped.customerName).toBe("Sarah Jenkins");
    // Lower-cased so the public lookup by email matches reliably.
    expect(mapped.customerEmail).toBe("sarah@example.com");
    expect(mapped.currency).toBe("AUD");
    expect(mapped.lineItems).toHaveLength(2);
    expect(mapped.lineItems[1].variantTitle).toBe("Sand");
    expect(mapped.cancelledAt).toBeNull();
  });

  it("survives a sparse payload without throwing", () => {
    const mapped = mapOrderPayload({ id: 1 });

    expect(mapped.orderNumber).toBe("#1");
    expect(mapped.customerEmail).toBeNull();
    expect(mapped.lineItems).toEqual([]);
    expect(mapped.orderDate).toBeInstanceOf(Date);
    // Falls back to the store's currency rather than inventing one.
    expect(mapped.currency).toBe("AUD");
  });

  it("records a cancellation timestamp when present", () => {
    const mapped = mapOrderPayload({
      id: 2,
      cancelled_at: "2025-10-06T09:00:00Z",
    });
    expect(mapped.cancelledAt).toEqual(new Date("2025-10-06T09:00:00Z"));
  });

  it("falls back to the billing address when there is no shipping address", () => {
    const mapped = mapOrderPayload({
      id: 3,
      billing_address: { address1: "1 Test St", city: "Sydney" },
    });
    expect(mapped.shippingAddress?.address1).toBe("1 Test St");
  });
});

// ---------------------------------------------------------------------------

describe("secret encryption", () => {
  let encryptSecret: typeof import("@/lib/crypto/secrets").encryptSecret;
  let decryptSecret: typeof import("@/lib/crypto/secrets").decryptSecret;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const mod = await import("@/lib/crypto/secrets");
    encryptSecret = mod.encryptSecret;
    decryptSecret = mod.decryptSecret;
  });

  it("round-trips a Shopify access token", () => {
    const token = "shpat_0123456789abcdef";
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("produces a different ciphertext each time", () => {
    const token = "shpat_same";
    expect(encryptSecret(token)).not.toBe(encryptSecret(token));
  });

  it("refuses to decrypt tampered ciphertext", () => {
    const payload = encryptSecret("shpat_secret");
    const parts = payload.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("refuses a malformed payload", () => {
    expect(() => decryptSecret("not-a-secret")).toThrow(/Malformed/);
  });
});
