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

/** `.875rem` and `0.875rem` are the same number written two ways. */
function rem(value: string): number {
  return Number.parseFloat(value.replace("rem", ""));
}

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
      } else if (rem(embedded) !== rem(size)) {
        disagreements.push(`${name}: ${size} on our domain, ${embedded} in a theme`);
      }
    }

    expect(disagreements, disagreements.join("\n  ")).toEqual([]);
  });

  it("is larger than the back office scale it used to borrow", () => {
    // The point of the override. `text-small` at 14px is a table row; this
    // page is read by customers, often on a phone.
    const small = globalScale().get("text-small");
    expect(small).toBeTruthy();
    expect(rem(small!)).toBeGreaterThanOrEqual(1);
  });
});
