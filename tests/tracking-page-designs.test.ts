import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveBranding } from "@/components/tracking/branding";
import { TRACKING_SCOPE_ID } from "@/components/tracking/embed-styles";
import { buildSampleView } from "@/components/tracking/sample-view";
import { TrackingPage } from "@/components/tracking/tracking-page";
import type { Stage } from "@/lib/db";
import {
  PAGE_DESIGNS,
  pageDesignCss,
  resolvePageDesign,
} from "@/lib/tracking/page-designs";

/**
 * A design's layer is injected into the merchant's own storefront, so every
 * selector has to stay inside the tracking page — one that escaped would
 * restyle their header or footer.
 */
const scope = `#${TRACKING_SCOPE_ID}`;

describe("tracking page designs", () => {
  it.each(PAGE_DESIGNS.map((design) => design.id))(
    "keeps every %s selector inside the page and its own design",
    (id) => {
      // Container queries wrap whole rules; unwrap them so the selectors inside
      // are checked like any other.
      const css = pageDesignCss(id, scope).replace(/@(media|container)[^{]+\{([^{}]+\{[^}]*\})\}/g, "$2");
      const selectors = [...css.matchAll(/([^{}]+)\{[^}]*\}/g)].flatMap(
        (match) => match[1].split(","),
      );
      for (const selector of selectors) {
        expect(selector.trim().startsWith(`${scope}[data-design="${id}"]`)).toBe(true);
      }
    },
  );

  it("uses px, never rem, so a theme's root font size cannot shrink it", () => {
    for (const design of PAGE_DESIGNS) {
      // `em` letter-spacing is fine: it follows the element, not the root.
      expect(pageDesignCss(design.id, scope)).not.toMatch(/\drem\b/);
    }
  });

  it("falls back to the standard design", () => {
    expect(resolvePageDesign("gone")).toBe("standard");
    expect(pageDesignCss("gone", scope)).toBe("");
  });

  it("gives every design a complete, valid preset", () => {
    for (const design of PAGE_DESIGNS) {
      const { preset } = design;
      for (const colour of [
        preset.primaryColor,
        preset.accentColor,
        preset.backgroundColor,
        preset.textColor,
        preset.secondaryColor,
      ]) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(preset.cardRadius).toBeGreaterThanOrEqual(0);
      expect(preset.cardRadius).toBeLessThanOrEqual(32);
      expect(preset.buttonRadius).toBeLessThanOrEqual(40);
      expect(preset.headingFontSize).toBeLessThanOrEqual(48);
    }
  });
});

// ---------------------------------------------------------------------------
// The designed layouts rearrange the page, so each one is rendered for real.
// ---------------------------------------------------------------------------

const stages = ["Order placed", "Confirmed", "Processing", "Delivered"].map(
  (name, position) =>
    ({
      id: `s${position}`,
      storeId: "s",
      key: name.toLowerCase().replace(/ /g, "-"),
      name,
      description: "",
      position,
      icon: "circle",
      color: "#888888",
      isTerminal: position === 3,
      triggersFulfillment: false,
      locksAddressEditing: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as unknown as Stage,
);

function renderPage(
  design: string,
  options: {
    order: boolean;
    access?: "verified" | "order-number";
    cancelled?: boolean;
    showStoreName?: boolean;
  },
): string {
  const branding = {
    ...resolveBranding(null),
    pageDesign: design,
    showStoreName: options.showStoreName ?? false,
  };
  const view = options.order ? buildSampleView(stages) : null;
  if (view && options.cancelled) view.order.cancelledAt = new Date();
  return renderToStaticMarkup(
    createElement(TrackingPage, {
      branding,
      store: { name: "Northside Supply", shopDomain: "n.myshopify.com" },
      view,
      proxyPath: "/apps/track-order",
      lookupStep: { step: "identify" },
      access: options.access ?? "verified",
    }),
  );
}

describe("designed tracking layouts", () => {
  it.each(PAGE_DESIGNS.map((design) => design.id))(
    "renders the %s design for the lookup and for an order",
    (id) => {
      const lookup = renderPage(id, { order: false });
      expect(lookup).toContain(`data-design="${id}"`);
      expect(lookup).toContain('name="q"');

      const order = renderPage(id, { order: true });
      expect(order).toContain("#1042");
      expect(order).toContain("Confirmed");
      expect(order).toContain("12 Bourke Street");
    },
  );

  it.each(PAGE_DESIGNS.map((design) => design.id))(
    "never shows an unverified visitor the street address in %s",
    (id) => {
      const html = renderPage(id, { order: true, access: "order-number" });
      expect(html).not.toContain("12 Bourke Street");
      expect(html).not.toContain("Sarah Jenkins");
      expect(html).toContain("Sarah J.");
    },
  );

  /** The page's markup alone; its `<style>` names every part too. */
  const markup = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "");

  const designed = PAGE_DESIGNS.filter((design) => design.layout !== "column").map(
    (design) => design.id,
  );

  it.each(designed)("headlines a cancelled order as cancelled in %s", (id) => {
    const html = markup(renderPage(id, { order: true, cancelled: true }));
    expect(html).toContain("Order cancelled");
    expect(html).toContain("This order was cancelled.");
    // The stage it was cancelled at is never presented as "now".
    expect(html).not.toMatch(/>Now</);
    expect(html).not.toContain('data-part="progress"');
  });

  it.each(["atelier", "beaute", "maison"])(
    "keeps the store's brand mark off %s unless the store name is shown",
    (id) => {
      const hidden = markup(renderPage(id, { order: true }));
      expect(hidden).not.toContain('data-part="beaute-bar"');
      expect(hidden).not.toContain('data-part="monogram"');
      expect(hidden).not.toMatch(/data-part="atelier-wordmark">Northside/);

      const shown = markup(renderPage(id, { order: true, showStoreName: true }));
      expect(shown).toMatch(/data-part="(beaute-bar|monogram|atelier-wordmark)"[^>]*>(Northside|NS)/);
    },
  );

  it("gives every designed layout an h1 on the order view", () => {
    for (const id of designed) {
      expect(renderPage(id, { order: true })).toMatch(/<h1[\s>]/);
    }
  });
});
