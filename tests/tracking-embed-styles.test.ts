import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrackingPage } from "@/components/tracking/tracking-page";
import { resolveBranding } from "@/components/tracking/branding";

import {
  TRACKING_EMBED_CSS,
  TRACKING_SCOPE_ID,
} from "@/components/tracking/embed-styles";
import { neutraliseLiquid } from "@/app/proxy/track-order/route";

/**
 * The tracking page embedded in a Shopify theme.
 *
 * It is served as Liquid and dropped into the merchant's own layout, which
 * makes two things true that are not true anywhere else in this app:
 *
 *   1. It cannot rely on the app's Tailwind build, so it carries its own CSS —
 *      and a class the components use but that sheet does not define is a
 *      silently broken layout on somebody's storefront, not a build error.
 *   2. Its markup is executed as a template by the merchant's store before the
 *      customer sees it, so anything that looks like a Liquid tag has to stop
 *      looking like one first.
 */

const ROOT = process.cwd();
const DIR = "components/tracking";

function componentSources(): Array<{ file: string; source: string }> {
  return readdirSync(path.join(ROOT, DIR))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({
      file: `${DIR}/${name}`,
      source: readFileSync(path.join(ROOT, DIR, name), "utf8"),
    }));
}

/** Every class named in a `className="…"` across the tracking components. */
function usedClasses(): Map<string, string> {
  const owners = new Map<string, string>();

  for (const { file, source } of componentSources()) {
    for (const match of source.matchAll(/className="([^"]*)"/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) {
        if (!owners.has(name)) owners.set(name, file);
      }
    }
  }
  return owners;
}

/** How the class appears once escaped for a CSS selector. */
function asSelector(name: string): string {
  // `sm:p-6` → `.sm\:p-6`, `max-w-[40rem]` → `.max-w-\[40rem\]`.
  return `.${name.replace(/([:.[\]])/g, "\\$1")}`;
}

/**
 * Every class the components actually emit, for both states of the page.
 *
 * Reading the source for `className="…"` misses anything built at runtime —
 * a template literal, a ternary, a variable holding a class list. That gap is
 * not theoretical: it let `h-px` ship with no rule behind it, invisible
 * everywhere except on a phone, on a storefront. Rendering the page and
 * reading the markup back catches whatever the components really produce.
 */
function renderedClasses(): Map<string, string> {
  const store = {
    id: "s",
    name: "Northside Supply",
    shopDomain: "n.myshopify.com",
  } as never;

  const stage = (
    id: string,
    name: string,
    position: number,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    storeId: "s",
    key: id,
    name,
    description: "",
    position,
    icon: "circle",
    color: "#2563eb",
    isTerminal: false,
    triggersFulfillment: false,
    locksAddressEditing: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });

  const stages = [
    stage("placed", "Order Placed", 0),
    stage("out", "Out for Delivery", 1),
    stage("delivered", "Delivered", 2, { isTerminal: true }),
  ];

  const order = {
    id: "o1",
    storeId: "s",
    shopifyOrderId: "1",
    orderNumber: "#1042",
    customerName: "Sarah Jenkins",
    customerEmail: "sarah@example.com",
    customerPhone: null,
    shippingAddress: { address1: "12 Bourke Street", city: "Melbourne" },
    lineItems: [{ title: "Bamboo Cutlery Set", quantity: 2, price: "19.99" }],
    orderDate: new Date("2026-08-27T06:26:00Z"),
    total: "39.98",
    currency: "AUD",
    currentStageId: "out",
    fulfillmentStatus: "unfulfilled",
    shopifyFulfillmentId: null,
    fulfilledAt: null,
    fulfillmentError: null,
    assignedDriverName: "Sam",
    trackingToken: "tok",
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const view = {
    order,
    stage: stages[1],
    timeline: stages.map((entry, index) => ({
      stage: entry,
      state: index === 0 ? "done" : index === 1 ? "current" : "upcoming",
    })),
    events: [
      {
        event: {
          id: "e1",
          storeId: "s",
          orderId: "o1",
          stageId: "out",
          occurredAt: new Date("2026-08-28T09:00:00Z"),
          note: "With our driver now.",
          createdByUserId: null,
          source: "agency",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        stage: stages[1],
      },
    ],
    lastUpdate: null,
    proof: null,
    canEditAddress: true,
  };
  view.lastUpdate = view.events[0] as never;

  const branding = resolveBranding({
    faq: [{ question: "When will it arrive?", answer: "Soon." }],
    helpBannerText: "Need help?",
    showStoreName: true,
  } as never);

  const owners = new Map<string, string>();

  for (const [label, current] of [
    ["lookup", null],
    ["order", view],
  ] as const) {
    const html = renderToStaticMarkup(
      TrackingPage({
        branding,
        store,
        view: current as never,
        proxyPath: "/apps/track-order",
        lookupStep: { step: "identify" },
        lookupMode: "email-only",
        access: "none",
        lookupError: null,
        addressMessage: null,
        addressError: null,
      }) as never,
    );

    for (const match of html.matchAll(/class="([^"]*)"/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) {
        if (!owners.has(name)) owners.set(name, `rendered (${label})`);
      }
    }
  }

  return owners;
}

describe("the embedded stylesheet covers what the components use", () => {
  it("defines every class the rendered page actually emits", () => {
    const missing: string[] = [];

    for (const [name, where] of renderedClasses()) {
      if (!TRACKING_EMBED_CSS.includes(asSelector(name))) {
        missing.push(`${name} (${where})`);
      }
    }

    expect(
      missing,
      `These classes reach the storefront with no rule behind them:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("defines every class the tracking components render", () => {
    const missing: string[] = [];

    for (const [name, file] of usedClasses()) {
      if (!TRACKING_EMBED_CSS.includes(asSelector(name))) {
        missing.push(`${name} (${file})`);
      }
    }

    expect(
      missing,
      `These classes render on the storefront with no rule behind them:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("scopes every rule to the tracking root", () => {
    // Anything that escaped the scope would style the merchant's own header,
    // navigation or footer — their site, broken by our page.
    const selectors = TRACKING_EMBED_CSS.split("}")
      .map((block) => block.slice(block.lastIndexOf("{") === -1 ? 0 : 0))
      .join("}")
      .match(/(^|[}])([^{}@]+)\{/g);

    expect(selectors).not.toBeNull();

    for (const raw of selectors ?? []) {
      const selector = raw.replace(/^[}]/, "").replace(/\{$/, "").trim();
      // Keyframe steps (`0%,100%`, `50%`) carry no selector of their own.
      if (/^[\d%,.\s]+$/.test(selector)) continue;

      for (const part of selector.split(",")) {
        expect(
          part.trim().startsWith(`#${TRACKING_SCOPE_ID}`),
          `unscoped selector: ${part.trim()}`,
        ).toBe(true);
      }
    }
  });

  it("reaches the classes carried by the root element itself", () => {
    // `.tracking-root` and `.min-h-dvh` sit on `#tracky-tracking`, not inside
    // it. Written as a descendant selector they match nothing at all, and the
    // page silently inherits the theme's font and colours — which looks like
    // branding not working rather than like a broken selector.
    for (const className of [".tracking-root", ".min-h-dvh"]) {
      expect(
        TRACKING_EMBED_CSS,
        `${className} is only reachable as a descendant`,
      ).toContain(`#${TRACKING_SCOPE_ID}${className}`);
    }
  });

  it("carries no global reset", () => {
    // A bare element or universal selector is how a stylesheet injected into
    // somebody else's page takes their layout apart.
    expect(TRACKING_EMBED_CSS).not.toMatch(/(^|})\s*\*/);
    expect(TRACKING_EMBED_CSS).not.toMatch(/(^|})\s*(body|html)\s*[,{]/);
  });
});

describe("nothing on the page reaches Liquid as a tag", () => {
  it("encodes braces in markup", () => {
    const hostile = "<p>Hi {{ shop.email }} and {% assign x = 1 %}</p>";
    const out = neutraliseLiquid(hostile);

    expect(out).not.toContain("{{");
    expect(out).not.toContain("{%");
    expect(out).toContain("&#123;&#123;");
    // The customer still reads what they typed.
    expect(out).toContain("shop.email");
  });

  it("leaves the stylesheet's own braces alone", () => {
    // CSS is not HTML: entities inside <style> are not decoded, so encoding
    // there would ship a broken sheet.
    const out = neutraliseLiquid(`<style>${TRACKING_EMBED_CSS}</style><p>{{x}}</p>`);

    expect(out).toContain(`<style>${TRACKING_EMBED_CSS}</style>`);
    expect(out).toContain("&#123;&#123;x&#125;&#125;");
  });

  it("handles several style blocks, encoding only between them", () => {
    // The branding block is emitted inside the markup, so there is always more
    // than one — an implementation that only skipped the first would mangle it.
    const out = neutraliseLiquid(
      "<style>a{color:red}</style><p>{{a}}</p><style>b{color:blue}</style><p>{{b}}</p>",
    );

    expect(out).toContain("<style>a{color:red}</style>");
    expect(out).toContain("<style>b{color:blue}</style>");
    expect(out).not.toContain("<p>{{a}}</p>");
    expect(out).not.toContain("<p>{{b}}</p>");
  });
});
