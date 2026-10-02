import { Body, Head, Html, Preview } from "@react-email/components";

import {
  BRANDING_FALLBACK,
  resolveFontStack,
} from "@/components/tracking/branding";
import type { BrandingSettings, Store } from "@/lib/db";
import type { MergeContext } from "../merge";

/**
 * What every design is built from: the store's branding and the merged order
 * facts, resolved once so each layout only decides how they look.
 */

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const GROTESK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', Times, serif";

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** Parses `#rgb` / `#rrggbb`, or nothing. */
export function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * `weight` parts of `fg` over `bg`, as a flat hex.
 *
 * Email clients have no `color-mix()`, so every tint and hairline a layout
 * uses is computed here and shipped as a literal colour.
 */
export function mix(fg: string, bg: string, weight: number): string {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return bg;

  return `#${a
    .map((channel, i) =>
      Math.round(channel * weight + b[i] * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * `color` when it stands out against `background` (3:1, the bar for large
 * marks), otherwise `fallback`. Keeps a navy brand colour from disappearing
 * into a black hero.
 */
export function visibleOn(
  color: string,
  background: string,
  fallback: string,
): string {
  const a = parseHex(color);
  const b = parseHex(background);
  if (!a || !b) return fallback;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05) >= 3 ? color : fallback;
}

// ---------------------------------------------------------------------------
// The admin's own HTML
// ---------------------------------------------------------------------------

export type BodyPalette = {
  text: string;
  muted: string;
  link: string;
  size: number;
  /** Font for h1–h3 inside the body; defaults to the body's own. */
  headingFont?: string;
};

/**
 * Inlines typography onto the body an owner wrote in the template editor.
 *
 * Their HTML is bare `<p>` and `<a>` tags. Left alone, two things go wrong in
 * every client that matters: Outlook applies its own paragraph margins, which
 * are nothing like the rest of the message, and links render in browser-default
 * blue with an underline — the single loudest way an otherwise careful email
 * announces that nobody styled it.
 *
 * Declarations are prepended, never appended, so anything the author set
 * themselves still wins.
 */
export function styleAuthoredHtml(html: string, palette: BodyPalette): string {
  const line = Math.round(palette.size * 1.6);
  const heading = palette.headingFont
    ? `font-family:${palette.headingFont.replace(/"/g, "'")};`
    : "";

  const rules: Record<string, string> = {
    p: `margin:0 0 16px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    a: `color:${palette.link};font-weight:600;text-decoration:underline;`,
    strong: `font-weight:600;color:${palette.text};`,
    b: `font-weight:600;color:${palette.text};`,
    ul: `margin:0 0 16px;padding-left:20px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    ol: `margin:0 0 16px;padding-left:20px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    li: `margin:0 0 6px;`,
    h1: `margin:24px 0 10px;font-size:20px;line-height:26px;font-weight:600;color:${palette.text};${heading}`,
    h2: `margin:24px 0 10px;font-size:18px;line-height:24px;font-weight:600;color:${palette.text};${heading}`,
    h3: `margin:20px 0 8px;font-size:16px;line-height:22px;font-weight:600;color:${palette.text};${heading}`,
    blockquote: `margin:0 0 16px;padding:2px 0 2px 14px;border-left:2px solid ${palette.muted};color:${palette.muted};`,
  };

  return html.replace(
    /<(p|a|strong|b|ul|ol|li|h1|h2|h3|blockquote)(\s[^>]*?)?>/gi,
    (match, rawTag: string, attrs = "") => {
      const declarations = rules[rawTag.toLowerCase()];
      if (!declarations) return match;

      if (/\sstyle\s*=\s*["']/i.test(attrs)) {
        return match.replace(
          /style\s*=\s*(["'])(.*?)\1/i,
          (_full, quote: string, existing: string) =>
            `style=${quote}${declarations}${existing}${quote}`,
        );
      }
      return `<${rawTag}${attrs} style="${declarations}">`;
    },
  );
}

/** Trailing paragraph margin, so the block below sits on the grid. */
export function trimTrailingMargin(html: string): string {
  return html.replace(/margin:0 0 16px;(?![\s\S]*margin:0 0 16px;)/, "margin:0;");
}

/** Styles the owner's body for one design and trims its last margin. */
export function authoredBody(html: string, palette: BodyPalette): string {
  return trimTrailingMargin(styleAuthoredHtml(html, palette));
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type EmailModel = {
  storeName: string;
  logoUrl: string | null;
  previewText: string;
  /** The owner's merged, still unstyled HTML. Each design styles it. */
  html: string;

  accent: string;
  surface: string;
  text: string;
  link: string;
  font: string;
  size: number;

  stage: string;
  orderNumber: string;
  orderDate: string;
  address: string;
  trackingUrl: string;
  helpUrl: string;
  postalAddress: string;
  footerText: string;
};

export function buildEmailModel({
  branding,
  store,
  previewText,
  html,
  context,
}: {
  branding: BrandingSettings | null;
  store: Pick<Store, "name" | "shopDomain">;
  previewText: string;
  html: string;
  context: MergeContext;
}): EmailModel {
  const storeName = store.name ?? store.shopDomain;
  const address = context.shipping_address?.trim() ?? "";

  return {
    storeName,
    logoUrl: branding?.logoUrl?.trim() || null,
    previewText,
    html,

    accent: branding?.primaryColor ?? BRANDING_FALLBACK.primaryColor,
    surface: branding?.backgroundColor ?? BRANDING_FALLBACK.backgroundColor,
    text: branding?.textColor ?? BRANDING_FALLBACK.textColor,
    link: branding?.accentColor ?? BRANDING_FALLBACK.accentColor,
    font: resolveFontStack(branding?.fontFamily),
    size: branding?.baseFontSize ?? 16,

    stage: context.current_stage?.trim() ?? "",
    orderNumber: context.order_number?.trim() ?? "",
    orderDate: context.order_date?.trim() ?? "",
    // The merge field reads "—" when there is no address, which is right in
    // a sentence and wrong as a fact: layouts check for a value and would
    // print "Delivery: —". Treated as absent here, once, for every design.
    address: address === "—" ? "" : address,
    trackingUrl: context.tracking_link?.trim() ?? "",
    helpUrl: branding?.helpBannerUrl?.trim() ?? "",
    postalAddress: branding?.postalAddress?.trim() ?? "",
    footerText:
      branding?.footerText?.trim() ||
      `You are receiving this email because you placed an order with ${storeName}.`,
  };
}

/** `ORDER #1042 · 5 OCT 2025` — each fact once, ahead of the headline. */
export function eyebrowOf(model: EmailModel, separator = "  ·  "): string {
  return [model.orderNumber && `Order ${model.orderNumber}`, model.orderDate]
    .filter(Boolean)
    .join(separator);
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/** `<html>`, `<head>`, preheader and `<body>`, shared by every design. */
export function EmailShell({
  model,
  background,
  font,
  dark = false,
  children,
}: {
  model: EmailModel;
  background: string;
  font?: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const scheme = dark ? "dark" : "light";

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content={scheme} />
        <meta name="supported-color-schemes" content={scheme} />
      </Head>
      {model.previewText ? <Preview>{model.previewText}</Preview> : null}

      <Body
        style={{
          backgroundColor: background,
          fontFamily: font ?? model.font,
          margin: 0,
          padding: 0,
          width: "100%",
          WebkitTextSizeAdjust: "100%",
          textSizeAdjust: "100%",
        }}
      >
        {children}
      </Body>
    </Html>
  );
}

export type DesignLayout = (props: { model: EmailModel }) => React.ReactElement;
