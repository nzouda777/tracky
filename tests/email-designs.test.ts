import { describe, expect, it } from "vitest";

import {
  DESIGN_SAMPLE,
  EMAIL_DESIGNS,
  resolveEmailDesign,
} from "@/lib/email/designs/catalog";
import { sampleMergeContext } from "@/lib/email/merge";
import { renderEmail } from "@/lib/email/render";

/**
 * Every design in the gallery has to render, carry the facts the shell owns,
 * and keep the owner's copy — a design that throws would turn into a silently
 * failed send for every template using it.
 */
const store = { name: "Northside Supply", shopDomain: "northside.myshopify.com" };

describe("email designs", () => {
  it.each(EMAIL_DESIGNS.map((design) => design.id))(
    "renders the %s design",
    async (design) => {
      const rendered = await renderEmail({
        ...DESIGN_SAMPLE,
        design,
        context: sampleMergeContext(store.name),
        branding: null,
        store,
      });

      expect(rendered.subject).toBe("Order #1042 is out for delivery");
      expect(rendered.html).toContain("Sarah Jenkins");
      expect(rendered.html).toContain("#1042");
      expect(rendered.html).toContain("12 Bourke St");
      expect(rendered.html).toContain('href="https://store.com/apps/track-order');
      // Northside Supply appears as wordmark or footer in every design.
      expect(rendered.html).toContain("Northside Supply");
      // No <style> dependence: the owner's paragraphs carry inline styles.
      expect(rendered.html).toMatch(/<p style="margin:0 0 16px;/);
      expect(rendered.text).toContain("Sarah Jenkins");
    },
  );

  it("renders each design differently", async () => {
    const htmls = await Promise.all(
      EMAIL_DESIGNS.map(async (design) =>
        (
          await renderEmail({
            ...DESIGN_SAMPLE,
            design: design.id,
            context: sampleMergeContext(store.name),
            branding: null,
            store,
          })
        ).html,
      ),
    );
    expect(new Set(htmls).size).toBe(EMAIL_DESIGNS.length);
  });

  it("falls back to the default design for unknown ids", async () => {
    expect(resolveEmailDesign("nope")).toBe("classic");
    expect(resolveEmailDesign(null)).toBe("classic");

    const args = {
      ...DESIGN_SAMPLE,
      context: sampleMergeContext(store.name),
      branding: null,
      store,
    };
    const unknown = await renderEmail({ ...args, design: "retired-design" });
    const classic = await renderEmail({ ...args, design: "classic" });
    expect(unknown.html).toBe(classic.html);
  });
});
