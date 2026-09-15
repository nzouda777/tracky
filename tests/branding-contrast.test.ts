import { describe, expect, it } from "vitest";

import { mutedOn, readableOn } from "@/components/tracking/branding";

/**
 * A store can pick any colours it likes, and the floor has to hold anyway.
 * These are the two places where a bad pick would otherwise produce text
 * nobody can read: labels set in the muted tone, and text sitting on a filled
 * accent (buttons, the email's call to action).
 */
function parse(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Text, surface — including deliberately awkward combinations. */
const THEMES: Array<[string, string]> = [
  ["#131A24", "#FFFFFF"], // the Dispatch default
  ["#431407", "#FFFBF7"], // a warm theme
  ["#E6E8E4", "#131A24"], // dark mode
  ["#10231C", "#FFFFFF"],
  ["#555555", "#FFFFFF"], // soft grey text: the case a fixed mix would fail
  ["#333333", "#EFEFEF"],
  ["#000000", "#FFFFFF"],
];

describe("mutedOn", () => {
  it("clears AA on every theme, including low-contrast ones", () => {
    for (const [text, surface] of THEMES) {
      const muted = mutedOn(text, surface);
      expect(
        ratio(muted, surface),
        `${text} on ${surface} -> ${muted}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("stays lighter than the text colour when it can afford to", () => {
    // The point of a muted tone is that it recedes. On a theme with headroom
    // it must not simply return the text colour.
    expect(mutedOn("#131A24", "#FFFFFF")).not.toBe("#131A24");
    expect(ratio(mutedOn("#131A24", "#FFFFFF"), "#FFFFFF")).toBeLessThan(
      ratio("#131A24", "#FFFFFF"),
    );
  });

  it("gives back something usable for a malformed colour", () => {
    expect(mutedOn("nonsense", "#FFFFFF")).toBe("nonsense");
  });
});

describe("readableOn", () => {
  it("picks the more readable of white and ink for any accent", () => {
    for (const accent of [
      "#1B2B44",
      "#F5A524",
      "#FFFFFF",
      "#000000",
      "#2E7D5B",
      "#E6E8E4",
      "#9FB4D4",
    ]) {
      const chosen = readableOn(accent);
      const other = chosen === "#FFFFFF" ? "#131A24" : "#FFFFFF";
      expect(
        ratio(chosen, accent),
        `${accent} -> ${chosen}`,
      ).toBeGreaterThanOrEqual(ratio(other, accent));
    }
  });

  it("clears AA on a pale accent, which is where white would fail", () => {
    // A store picking hi-vis amber as its accent must not get white-on-amber.
    expect(readableOn("#F5A524")).toBe("#131A24");
    expect(ratio(readableOn("#F5A524"), "#F5A524")).toBeGreaterThanOrEqual(4.5);
  });

  it("defaults to white when the colour cannot be parsed", () => {
    expect(readableOn("not-a-colour")).toBe("#FFFFFF");
  });
});
