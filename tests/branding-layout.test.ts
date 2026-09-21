import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BRANDING_FALLBACK,
  BrandingStyle,
  resolveBranding,
  type Branding,
} from "@/components/tracking/branding";

/**
 * The tracking widget's layout settings.
 *
 * These end up as custom properties in a stylesheet on a customer-facing page
 * inside somebody's storefront, so what matters is that every one of them
 * reaches the page, and that nothing a merchant can type produces a layout
 * they cannot see is broken — a 4000px column or a negative radius is not a
 * style, it is a bug nobody notices until an order goes missing.
 */

function css(overrides: Partial<Branding> = {}): string {
  const branding = resolveBranding(overrides as never);
  return renderToStaticMarkup(
    BrandingStyle({ branding, scopeId: "tracky-tracking" }),
  );
}

function variable(sheet: string, name: string): string | null {
  return sheet.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim() ?? null;
}

describe("the defaults are the embedded look", () => {
  it("centres the column and does not repeat the store's name", () => {
    // The page renders between the merchant's own header and footer. A
    // left-aligned block with a second wordmark on top is the difference
    // between a section of their shop and an app bolted onto it.
    expect(BRANDING_FALLBACK.contentAlignment).toBe("center");
    expect(BRANDING_FALLBACK.showStoreName).toBe(false);
    expect(BRANDING_FALLBACK.buttonFullWidth).toBe(true);

    const sheet = css();
    expect(variable(sheet, "brand-align")).toBe("center");
    expect(variable(sheet, "brand-button-width")).toBe("100%");
  });

  it("carries every layout setting into the stylesheet", () => {
    const sheet = css({
      contentAlignment: "left",
      contentWidth: 820,
      cardRadius: 4,
      buttonRadius: 28,
      buttonFullWidth: false,
      sectionBackground: "#EEF1F4",
    } as Partial<Branding>);

    expect(variable(sheet, "brand-align")).toBe("left");
    expect(variable(sheet, "brand-width")).toBe("820px");
    expect(variable(sheet, "brand-card-radius")).toBe("4px");
    expect(variable(sheet, "brand-button-radius")).toBe("28px");
    expect(variable(sheet, "brand-button-width")).toBe("auto");
    expect(variable(sheet, "brand-section")).toBe("#EEF1F4");
  });

  it("ships with a band, so the card has something to sit on", () => {
    // The default look puts the form in its own band below the title block.
    expect(BRANDING_FALLBACK.sectionBackground).toBeTruthy();
    expect(variable(css(), "brand-section")).toBe(
      BRANDING_FALLBACK.sectionBackground,
    );
  });

  it("gives the card its own ground only when there is a band", () => {
    // With a band the card takes the page colour, so it lifts off instead of
    // sinking into it. With none it is a tint of the page it sits on.
    const banded = css({ sectionBackground: "#EEF1F4" } as Partial<Branding>);
    expect(variable(banded, "brand-card")).toBe(
      BRANDING_FALLBACK.backgroundColor,
    );

    const plain = css({ sectionBackground: null } as Partial<Branding>);
    expect(variable(plain, "brand-section")).toBe(
      BRANDING_FALLBACK.backgroundColor,
    );
    expect(variable(plain, "brand-card")).toContain("color-mix");
  });

  it("falls back to copy that matches what the page accepts", () => {
    // Blank wording is the normal state, not an error: the form derives its
    // prompt from the lookup policy so it can never ask for a detail this
    // surface would refuse.
    expect(BRANDING_FALLBACK.formPrompt).toBe("");
    expect(BRANDING_FALLBACK.formPlaceholder).toBe("");
    expect(BRANDING_FALLBACK.formButtonLabel).toBe("");
  });

  it("scales the heading down on a phone", () => {
    // The stored size is a choice made looking at a desktop. Applied literally
    // it is most of the width of a 390px screen, which is what "stretched on
    // mobile" looks like. It becomes the ceiling of a clamp instead.
    const sheet = css({ headingFontSize: 42 } as Partial<Branding>);
    const heading = variable(sheet, "brand-heading-size") ?? "";

    expect(heading).toMatch(/^clamp\(/);
    expect(heading).toContain("42px");
    expect(heading).toContain("vw");

    // The floor is smaller than the ceiling, and never below readable.
    const floor = Number(heading.match(/clamp\((\d+)px/)?.[1]);
    expect(floor).toBeGreaterThanOrEqual(24);
    expect(floor).toBeLessThan(42);
  });

  it("leaves an already-small heading alone", () => {
    // A heading at or below the floor has nothing to scale down to, and a
    // clamp whose ends meet is just noise in the stylesheet.
    expect(
      variable(css({ headingFontSize: 22 } as Partial<Branding>), "brand-heading-size"),
    ).toBe("22px");
  });

  it("centres a logo only when the column is centred", () => {
    expect(variable(css(), "brand-logo-inline")).toBe("auto");
    expect(
      variable(css({ contentAlignment: "left" } as Partial<Branding>), "brand-logo-inline"),
    ).toBe("0");
  });
});

describe("nothing a merchant types can break the page", () => {
  it("keeps the font stack out of the surrounding CSS", () => {
    // The declaration sits inside a scoped block. A `}` in it would close the
    // block early and let whatever follows land on the merchant's own site.
    const sheet = css({
      fontFamily: "Comic Sans} body{display:none",
    } as Partial<Branding>);

    expect(sheet).not.toContain("body{display:none");
    expect(variable(sheet, "brand-font")).not.toContain("}");
  });

  it("emits a usable value for every property, whatever it is handed", () => {
    const sheet = css({ fontFamily: "   " } as Partial<Branding>);
    expect(variable(sheet, "brand-font")).toBe("inherit");
  });
});
