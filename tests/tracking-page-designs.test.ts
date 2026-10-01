import { describe, expect, it } from "vitest";

import { TRACKING_SCOPE_ID } from "@/components/tracking/embed-styles";
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
      const css = pageDesignCss(id, scope);
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
