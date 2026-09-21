import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { TRACKING_EMBED_CSS } from "@/components/tracking/embed-styles";

/**
 * One type scale, two stylesheets.
 *
 * The tracking page is styled by Tailwind on our own domain and by its own
 * self-contained sheet inside a Shopify theme. Both have to say the same thing
 * about how big the text is, and nothing in the build makes them agree — a
 * change to one is silent on the other, and the difference only shows up on a
 * merchant's storefront, next to a version that looks right.
 */

const ROOT = process.cwd();
const GLOBALS = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

/** Every `.tracking-root .text-*` rule in the global sheet. */
function globalScale(): Map<string, string> {
  const found = new Map<string, string>();

  for (const match of GLOBALS.matchAll(
    /\.tracking-root\s+\.(text-[a-z0-9-]+)\s*\{([^}]*)\}/g,
  )) {
    const size = match[2].match(/font-size:\s*([^;]+);/)?.[1].trim();
    if (size) found.set(match[1], size);
  }
  return found;
}

/** The same class's size in the embedded sheet. */
function embedSize(name: string): string | null {
  const rule = TRACKING_EMBED_CSS.match(
    new RegExp(`#tracky-tracking \\.${name}\\{([^}]*)\\}`),
  );
  return rule?.[1].match(/font-size:([^;]+)/)?.[1].trim() ?? null;
}

/**
 * A size as the pixels it resolves to.
 *
 * The two sheets deliberately use different units. On our own domain the page
 * is styled in rem, where the root is ours and 1rem is 16px. In a theme it is
 * styled in px, because the root belongs to the merchant and a theme that sets
 * `html { font-size: 62.5% }` would otherwise render the whole page at 62.5%.
 * Comparing the numbers as written would fail on that difference alone.
 */
function px(value: string): number {
  const amount = Number.parseFloat(value);
  return value.includes("rem") ? amount * 16 : amount;
}

describe("the embedded sheet never uses a unit the theme controls", () => {
  it("states every size in absolute units", () => {
    // `rem` is a fraction of the *root* font size, and the root belongs to the
    // merchant. A theme with `html { font-size: 62.5% }` — a common one —
    // renders every rem we emit at 62.5%: 17px body text as 10.6px, a 14px
    // caption as 8.75px, every gap and padding shrinking with them. It looks
    // perfect in any preview served from our own domain and wrong on every
    // storefront, which is the only place this sheet is used.
    // Only the declarations: `.max-w-\[40rem\]` is a class *name* the
    // components write, not a length the browser resolves.
    const declarations = [...TRACKING_EMBED_CSS.matchAll(/\{([^}]*)\}/g)]
      .flatMap((block) => block[1].match(/[\d.]+rem/g) ?? []);
    expect(
      declarations,
      `these resolve against the merchant's root font size: ${declarations.join(", ")}`,
    ).toEqual([]);
  });

  it("states the font family on the elements, not only the root", () => {
    // Inheritance loses to any rule the theme writes, so a bare
    // `h1 { font-family }` in their stylesheet takes our headings.
    expect(TRACKING_EMBED_CSS).toMatch(/h1[^{]*\{font-family:var\(--brand-font\)/);
  });
});

describe("the two stylesheets agree on the scale", () => {
  it("covers the classes the page actually sets", () => {
    const scale = globalScale();
    // A guard that matched nothing would pass forever.
    expect(scale.size).toBeGreaterThanOrEqual(6);
    expect([...scale.keys()]).toEqual(
      expect.arrayContaining([
        "text-caption",
        "text-small",
        "text-body",
        "text-h1",
      ]),
    );
  });

  it("sets the same size for every class, in both sheets", () => {
    const disagreements: string[] = [];

    for (const [name, size] of globalScale()) {
      const embedded = embedSize(name);
      if (embedded === null) {
        disagreements.push(`${name}: missing from the embedded sheet`);
      } else if (px(embedded) !== px(size)) {
        disagreements.push(
          `${name}: ${size} (${px(size)}px) on our domain, ${embedded} (${px(embedded)}px) in a theme`,
        );
      }
    }

    expect(disagreements, disagreements.join("\n  ")).toEqual([]);
  });

  it("is larger than the back office scale it used to borrow", () => {
    // The point of the override. `text-small` at 14px is a table row; this
    // page is read by customers, often on a phone.
    const small = globalScale().get("text-small");
    expect(small).toBeTruthy();
    expect(px(small!)).toBeGreaterThanOrEqual(16);
  });
});
