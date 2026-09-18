import type { BrandingSettings } from "@/lib/db";

/**
 * The default theme for customer-facing surfaces.
 *
 * These are the Dispatch values: ink on white, structured in dispatch navy,
 * with hi-vis amber held back for the active waypoint. A store overrides any
 * of them from Branding settings, and every component reads the resulting CSS
 * variables rather than a hard-coded colour — so a store's own palette reaches
 * the whole page, not just the parts someone remembered to wire up.
 */
export const BRANDING_FALLBACK = {
  primaryColor: "#1B2B44",
  secondaryColor: "#F5A524",
  backgroundColor: "#FFFFFF",
  textColor: "#131A24",
  accentColor: "#1B2B44",
  fontFamily: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  baseFontSize: 16,
  headingFontSize: 26,
  pageTitle: "Track your order",
  pageSubtitle: "Enter your details to see the latest delivery update.",
  helpBannerText: "Need help with your order? Contact our support team.",
  logoUrl: null as string | null,
  helpBannerUrl: null as string | null,
  footerText: "",
  faq: [] as Array<{ question: string; answer: string }>,
  showOrderSummary: true,
  showAddressEditing: true,
} as const;

/** Reserved across every theme: the terminal step, and nothing else. */
export const DELIVERED_COLOR = "#2E7D5B";

export type Branding = Omit<
  BrandingSettings,
  "id" | "storeId" | "createdAt" | "updatedAt"
>;

/** Merges a possibly-missing branding row with the defaults. */
export function resolveBranding(
  branding: BrandingSettings | null | undefined,
): Branding {
  return {
    ...BRANDING_FALLBACK,
    ...(branding ?? {}),
    faq: branding?.faq ?? [],
  } as Branding;
}

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Picks readable text for a filled swatch of `background`.
 *
 * A store can choose any accent, including a pale one, and a button that
 * hard-coded white text would then be unreadable. This compares both
 * candidates and takes the better, so the floor holds whatever is chosen.
 */
export function readableOn(background: string, ink = "#131A24"): string {
  const rgb = parseHex(background);
  if (!rgb) return "#FFFFFF";

  const inkRgb = parseHex(ink) ?? [19, 26, 36];
  const base = luminance(rgb);

  const onWhite = contrast(base, luminance([255, 255, 255]));
  const onInk = contrast(base, luminance(inkRgb));

  return onWhite >= onInk ? "#FFFFFF" : ink;
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  weight: number,
): [number, number, number] {
  return [
    a[0] * weight + b[0] * (1 - weight),
    a[1] * weight + b[1] * (1 - weight),
    a[2] * weight + b[2] * (1 - weight),
  ];
}

/**
 * Secondary text that still clears AA on the store's own background.
 *
 * Mixing the text colour a fixed percentage into the surface keeps the muted
 * tone in the same family as the theme, which is what we want — but a store
 * that picks a soft grey text on white would get a muted tone no one can read.
 * So the mix starts where it looks right and walks back towards the full text
 * colour until the contrast ratio clears 4.5:1. A theme with enough contrast
 * is untouched; one without is pulled back to legible.
 */
export function mutedOn(text: string, surface: string): string {
  const textRgb = parseHex(text);
  const surfaceRgb = parseHex(surface);
  if (!textRgb || !surfaceRgb) return text;

  const surfaceLuminance = luminance(surfaceRgb);

  for (let weight = 0.62; weight < 1; weight += 0.04) {
    const candidate = mix(textRgb, surfaceRgb, weight);
    if (contrast(luminance(candidate), surfaceLuminance) >= 4.5) {
      return toHex(candidate);
    }
  }

  // Even the text colour itself does not reach 4.5:1 against this background.
  // Nothing here can fix that — it is the store's own choice of text colour —
  // so use it rather than something strictly worse.
  return text;
}

/**
 * Exposes branding as CSS custom properties on a wrapper element, so the whole
 * page themes itself from the store's settings without inline styles on every
 * node. A `<style>` scoped by the wrapper id keeps it out of the global sheet.
 *
 * The derived values — muted text, rules, panel tint — are mixed from the
 * store's own text and surface colours rather than fixed greys, so they stay
 * in the same family as whatever the store picked.
 */
/**
 * The font stack, made safe outside our own pages.
 *
 * The default stack starts with `var(--font-archivo)`, a custom property
 * next/font defines on our documents. Anywhere else — an email client, or the
 * tracking page embedded in a merchant's Shopify theme — that property does
 * not exist, so the whole `font-family` declaration is invalid and the text
 * silently inherits whatever the surrounding page uses. On a serif theme that
 * is how our page ends up in Georgia.
 *
 * So the variable is swapped for the family's real name, and a stack still
 * carrying an unknowable custom property falls back entirely.
 */
export const PORTABLE_FONT_FALLBACK =
  "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function resolveFontStack(stack: string | null | undefined): string {
  if (!stack?.trim()) return PORTABLE_FONT_FALLBACK;
  const resolved = stack.replace(/var\(\s*--font-archivo\s*\)/g, "Archivo");
  return /var\(/.test(resolved) ? PORTABLE_FONT_FALLBACK : resolved;
}

/**
 * A value safe to drop into a declaration inside this scoped block.
 *
 * The font stack is free text an owner typed. A `}` in it would close the
 * block early and let the rest land on whatever follows — which, on the page
 * embedded in a Shopify theme, is the merchant's own site. Braces also carry
 * meaning to Liquid, which runs over that page before the browser sees it.
 * Colours are validated hex elsewhere; this is the one free-form value.
 */
function cssValue(value: string): string {
  return value.replace(/[{}<>;]/g, "").trim() || "inherit";
}

export function BrandingStyle({
  branding,
  scopeId,
}: {
  branding: Branding;
  scopeId: string;
}) {
  const surface = branding.backgroundColor;
  const text = branding.textColor;

  const css = `
#${scopeId} {
  --brand-accent: ${branding.primaryColor};
  --brand-signal: ${branding.secondaryColor};
  --brand-surface: ${surface};
  --brand-text: ${text};
  --brand-link: ${branding.accentColor};
  --brand-font: ${cssValue(branding.fontFamily)};
  --brand-scale: ${(branding.baseFontSize / 16).toFixed(4)};
  --brand-heading-size: ${branding.headingFontSize}px;
  --brand-delivered: ${DELIVERED_COLOR};
  --brand-on-accent: ${readableOn(branding.primaryColor, text)};
  --brand-muted: ${mutedOn(text, surface)};
  --brand-line: color-mix(in srgb, ${text} 14%, ${surface});
  --brand-panel: color-mix(in srgb, ${text} 4%, ${surface});
  --brand-wash: color-mix(in srgb, ${branding.primaryColor} 8%, ${surface});
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
