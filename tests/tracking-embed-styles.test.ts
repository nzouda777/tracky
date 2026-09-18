import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

describe("the embedded stylesheet covers what the components use", () => {
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
