import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { BRANDING_FALLBACK, DELIVERED_COLOR } from "@/components/tracking/branding";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

/** Every .tsx under app/ and components/, as [path, source]. */
function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir))) {
      const path = join(dir, entry);
      if (statSync(join(root, path)).isDirectory()) {
        walk(path);
      } else if (entry.endsWith(".tsx")) {
        out.push([relative(root, path).split("\\").join("/"), read(path)]);
      }
    }
  };

  walk("app");
  walk("components");
  return out;
}

const FILES = sources();

/**
 * DESIGN.md is a set of decisions, and decisions decay. These are the ones
 * that decay silently — nothing breaks, the page just drifts back towards the
 * generic template the design brief was written to avoid.
 */
describe("the design system holds its shape", () => {
  it("has no tracked ALL-CAPS eyebrows", () => {
    // Section labels are sentence case. A tracked ALL-CAPS label stacked over
    // every heading is the single most recognisable tell of a generated page.
    const offenders = FILES.filter(([, source]) =>
      /uppercase[^"'`]*tracking-(wide|wider|widest)|tracking-(wide|wider|widest)[^"'`]*uppercase/.test(
        source,
      ),
    ).map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("never suffixes a link or button with an arrow", () => {
    // `A → B` is a real transition and stays. `Templates →` is decoration.
    const offenders = FILES.filter(([, source]) =>
      /→\s*(\n|<\/|")/.test(source),
    ).map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("never chains three or more meta fragments with middots", () => {
    const offenders = FILES.filter(([, source]) =>
      source
        .split("\n")
        .some((line) => (line.match(/·/g) ?? []).length >= 2 && !line.includes("···")),
    ).map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("does not reproduce the cream-and-terracotta palette the brief rules out", () => {
    for (const [file, source] of FILES) {
      expect(source.toLowerCase(), file).not.toContain("f4f1ea");
      expect(source.toLowerCase(), file).not.toContain("d97757");
    }
  });
});

describe("colour roles stay reserved", () => {
  it("spends the hi-vis amber on marks, never on fills", () => {
    // `--signal` rings and underlines. The moment it becomes a background it
    // stops meaning "this is moving" and starts meaning "this is a button".
    for (const [file, source] of FILES) {
      expect(source, file).not.toContain("bg-signal");
      expect(source, file).not.toContain('backgroundColor: "var(--brand-signal)"');
      expect(source, file).not.toContain("backgroundColor: var(--brand-signal)");
    }
  });

  it("uses the delivered green only on the terminal waypoint", () => {
    const allowed = new Set([
      "components/tracking/branding.tsx",
      "components/tracking/route-line.tsx",
    ]);

    const offenders = FILES.filter(
      ([file, source]) =>
        !allowed.has(file) &&
        (source.includes("--brand-delivered") ||
          source.includes(DELIVERED_COLOR)),
    ).map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it("starts every store on the Dispatch defaults", () => {
    expect(BRANDING_FALLBACK.primaryColor).toBe("#1B2B44");
    expect(BRANDING_FALLBACK.secondaryColor).toBe("#F5A524");
    expect(BRANDING_FALLBACK.backgroundColor).toBe("#FFFFFF");
    expect(BRANDING_FALLBACK.textColor).toBe("#131A24");

    // The schema has to agree, or a fresh store and a missing row disagree.
    const schema = read("lib/db/schema.ts");
    expect(schema).toContain('"primary_color").notNull().default("#1B2B44")');
    expect(schema).toContain('"secondary_color").notNull().default("#F5A524")');
  });
});

describe("radii are a hierarchy, not one value", () => {
  it("uses only the named radii on the customer surface", () => {
    // Rules stay square, controls take 4px, panels take 10px, waypoints are
    // circles. A single rounded-xl everywhere is the flattened version.
    const offenders: string[] = [];

    for (const [file, source] of FILES) {
      if (!file.startsWith("components/tracking/")) continue;
      for (const match of source.match(/rounded-[a-z0-9[\]]+/g) ?? []) {
        if (!["rounded-full", "rounded-control", "rounded-panel"].includes(match)) {
          offenders.push(`${file}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("motion is spent once", () => {
  const css = read("app/globals.css");

  it("declares exactly one looping animation", () => {
    const infinite = css.match(/animation:[^;]*infinite/g) ?? [];
    expect(infinite).toHaveLength(1);
    expect(infinite[0]).toContain("waypoint-pulse");
  });

  it("stops it for anyone who asked for less motion", () => {
    expect(css).toContain("prefers-reduced-motion");
    const guard = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(guard).toContain("animation: none");
  });

  it("is the only thing on the page that moves by itself", () => {
    const offenders = FILES.filter(([, source]) =>
      /animate-(pulse|bounce|ping|spin)/.test(source),
    ).map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});

describe("mono is reserved for real codes", () => {
  it("is never applied to a plain label", () => {
    // `.type-code` marks order numbers, tracking ids and times. A label set in
    // mono is decoration pretending to be data.
    const uses = FILES.filter(([, source]) => source.includes("type-code"));
    expect(uses.length).toBeGreaterThan(0);

    for (const [file, source] of uses) {
      for (const line of source.split("\n")) {
        if (!line.includes("type-code")) continue;
        expect(line, `${file}: ${line.trim()}`).not.toMatch(
          /type-code[^>]*>\s*(Order no\.|Ship to|Placed|Total|Customer)\s*</,
        );
      }
    }
  });
});
