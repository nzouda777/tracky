import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

import {
  BRANDING_FALLBACK,
  mutedOn,
  readableOn,
  resolveFontStack,
} from "@/components/tracking/branding";
import type { BrandingSettings, Store } from "@/lib/db";
import { applyMergeFields, type MergeContext } from "./merge";

/**
 * Wraps a store's editable HTML body in a branded email layout.
 *
 * The body is admin-authored HTML with merge tokens; the surrounding shell —
 * wordmark, headline, call to action, delivery panel, footer — comes from
 * `branding_settings` and the merge context, so an owner restyling the
 * tracking page restyles their email at the same time and the two never
 * disagree.
 *
 * Three rules this layout is built around, each one a thing that makes a
 * transactional email look amateur:
 *
 *   1. **One call to action.** The shell owns the button, so a template body
 *      never has to carry its own link — two "Track your order" in one message,
 *      one of them a default-blue underline, was the old layout's worst tell.
 *   2. **Say each fact once.** The order number lives in the eyebrow, the
 *      address in the delivery panel. Neither is repeated by the shell.
 *   3. **Nothing depends on CSS an email client might drop.** Every rule is
 *      inline, including the ones applied to the admin's own HTML, because a
 *      `<style>` block is the first thing Outlook and Gmail throw away.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const PAPER = "#F1F2EF";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Parses `#rgb` / `#rrggbb`, or nothing. */
function parseHex(value: string): [number, number, number] | null {
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
 * Email clients have no `color-mix()`, so every tint and hairline this layout
 * uses is computed here and shipped as a literal colour.
 */
function mix(fg: string, bg: string, weight: number): string {
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

// ---------------------------------------------------------------------------
// The admin's own HTML
// ---------------------------------------------------------------------------

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
function styleAuthoredHtml(
  html: string,
  palette: { text: string; muted: string; link: string; size: number },
): string {
  const line = Math.round(palette.size * 1.6);

  const rules: Record<string, string> = {
    p: `margin:0 0 16px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    a: `color:${palette.link};font-weight:600;text-decoration:underline;`,
    strong: `font-weight:600;color:${palette.text};`,
    b: `font-weight:600;color:${palette.text};`,
    ul: `margin:0 0 16px;padding-left:20px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    ol: `margin:0 0 16px;padding-left:20px;font-size:${palette.size}px;line-height:${line}px;color:${palette.text};`,
    li: `margin:0 0 6px;`,
    h1: `margin:24px 0 10px;font-size:20px;line-height:26px;font-weight:600;color:${palette.text};`,
    h2: `margin:24px 0 10px;font-size:18px;line-height:24px;font-weight:600;color:${palette.text};`,
    h3: `margin:20px 0 8px;font-size:16px;line-height:22px;font-weight:600;color:${palette.text};`,
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
function trimTrailingMargin(html: string): string {
  return html.replace(/margin:0 0 16px;(?![\s\S]*margin:0 0 16px;)/, "margin:0;");
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function EmailLayout({
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
}) {
  const accent = branding?.primaryColor ?? BRANDING_FALLBACK.primaryColor;
  const surface = branding?.backgroundColor ?? BRANDING_FALLBACK.backgroundColor;
  const text = branding?.textColor ?? BRANDING_FALLBACK.textColor;
  const link = branding?.accentColor ?? BRANDING_FALLBACK.accentColor;
  const font = resolveFontStack(branding?.fontFamily);
  const size = branding?.baseFontSize ?? 16;
  const storeName = store.name ?? store.shopDomain;

  // Derived from the store's own colours rather than fixed greys, so a shop
  // with a dark or warm palette does not get a stack of neutral slate.
  const muted = mutedOn(text, surface);
  const hairline = mix(text, surface, 0.12);
  const panel = mix(text, surface, 0.04);

  const stage = context.current_stage?.trim();
  const orderNumber = context.order_number?.trim();
  const orderDate = context.order_date?.trim();
  const address = context.shipping_address?.trim();
  const trackingUrl = context.tracking_link?.trim();

  const body = trimTrailingMargin(
    styleAuthoredHtml(html, { text, muted, link, size }),
  );

  // `ORDER #1042 · 5 OCT 2025` — each fact once, ahead of the headline, so the
  // order number stops competing with the thing the email is actually about.
  const eyebrow = [orderNumber && `Order ${orderNumber}`, orderDate]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}

      <Body
        style={{
          backgroundColor: PAPER,
          fontFamily: font,
          margin: 0,
          padding: 0,
          width: "100%",
          WebkitTextSizeAdjust: "100%",
          textSizeAdjust: "100%",
        }}
      >
        <Section style={{ padding: "32px 12px 40px" }}>
          <Container
            style={{
              backgroundColor: surface,
              // The store's colour as a rule across the top: present on every
              // message, without a saturated band claiming progress the order
              // may not have made.
              //
              // It is the container's own border rather than a filled row.
              // A row had to be clipped to the rounded corners, and clipping a
              // table is exactly the kind of thing email clients decline to
              // do — it left a white notch at each end. A border follows the
              // radius for free, and degrades to a plain rule where the radius
              // is ignored.
              borderTop: `4px solid ${accent}`,
              borderRight: `1px solid ${hairline}`,
              borderBottom: `1px solid ${hairline}`,
              borderLeft: `1px solid ${hairline}`,
              borderRadius: 12,
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <Section style={{ padding: "28px 32px 0" }}>
              {branding?.logoUrl ? (
                <Img
                  src={branding.logoUrl}
                  alt={storeName}
                  style={{
                    display: "block",
                    maxHeight: 32,
                    maxWidth: 180,
                    height: "auto",
                  }}
                />
              ) : (
                <Text
                  style={{
                    color: text,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  {storeName}
                </Text>
              )}
            </Section>

            <Section style={{ padding: "24px 32px 0" }}>
              {eyebrow ? (
                <Text
                  style={{
                    color: muted,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    margin: "0 0 6px",
                  }}
                >
                  {eyebrow}
                </Text>
              ) : null}

              {stage ? (
                <Text
                  style={{
                    color: text,
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: "32px",
                    margin: 0,
                  }}
                >
                  {stage}
                </Text>
              ) : null}
            </Section>

            {/*
              Admin-authored body; merge values are HTML-escaped upstream and
              typography is inlined above. The raw HTML goes on an inner <div>,
              because <Section> renders its own children (a table wrapper) and
              React refuses both children and dangerouslySetInnerHTML on one
              element.
            */}
            <Section style={{ padding: `${stage || eyebrow ? 20 : 24}px 32px 0` }}>
              <div dangerouslySetInnerHTML={{ __html: body }} />
            </Section>

            {trackingUrl ? (
              <Section style={{ padding: "24px 32px 0" }}>
                <Button
                  href={trackingUrl}
                  style={{
                    backgroundColor: accent,
                    borderRadius: 8,
                    color: readableOn(accent, text),
                    display: "inline-block",
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    padding: "13px 26px",
                    textDecoration: "none",
                  }}
                >
                  Track your order
                </Button>
              </Section>
            ) : null}

            {address ? (
              <Section style={{ padding: "24px 32px 0" }}>
                <Section
                  style={{
                    backgroundColor: panel,
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <Text
                    style={{
                      color: muted,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      margin: "0 0 4px",
                    }}
                  >
                    Delivery address
                  </Text>
                  {/* Left-aligned and allowed to wrap. The old layout pinned
                      this to the right of a two-column row, where a real
                      address ran into the edge of the card. */}
                  <Text
                    style={{
                      color: text,
                      fontSize: 14,
                      lineHeight: "20px",
                      margin: 0,
                    }}
                  >
                    {address}
                  </Text>
                </Section>
              </Section>
            ) : null}

            <Section style={{ padding: "28px 32px 28px" }}>
              <Hr
                style={{
                  borderColor: hairline,
                  borderTopWidth: 1,
                  margin: "0 0 16px",
                }}
              />
              <Text
                style={{
                  color: muted,
                  fontSize: 13,
                  lineHeight: "19px",
                  margin: 0,
                }}
              >
                Questions about this order? Reply to this email
                {orderNumber ? (
                  <>
                    {" "}
                    and quote{" "}
                    <span style={{ fontFamily: MONO, color: text }}>
                      {orderNumber}
                    </span>
                  </>
                ) : null}
                .
              </Text>
            </Section>
          </Container>

          {/* Boilerplate sits outside the card: it belongs to the mailing, not
              to the message, and keeping it there stops the card trailing off
              into fine print. */}
          <Container style={{ maxWidth: 560, margin: "0 auto" }}>
            <Section style={{ padding: "20px 32px 0", textAlign: "center" }}>
              {branding?.helpBannerUrl ? (
                <Text style={{ fontSize: 13, margin: "0 0 6px" }}>
                  <Link
                    href={branding.helpBannerUrl}
                    style={{ color: link, fontWeight: 600 }}
                  >
                    Need help with your order?
                  </Link>
                </Text>
              ) : null}
              <Text
                style={{
                  color: mutedOn(text, PAPER),
                  fontSize: 12,
                  lineHeight: "18px",
                  margin: 0,
                }}
              >
                {branding?.footerText?.trim()
                  ? branding.footerText
                  : `You are receiving this email because you placed an order with ${storeName}.`}
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

export type RenderedEmail = { subject: string; html: string; text: string };

/** Applies merge fields and renders the final HTML + plain-text alternative. */
export async function renderEmail({
  subject,
  body,
  previewText,
  context,
  branding,
  store,
}: {
  subject: string;
  body: string;
  previewText?: string;
  context: MergeContext;
  branding: BrandingSettings | null;
  store: Pick<Store, "name" | "shopDomain">;
}): Promise<RenderedEmail> {
  const mergedSubject = applyMergeFields(subject, context, { escape: false });
  const mergedBody = applyMergeFields(body, context, { escape: true });
  const mergedPreview = applyMergeFields(previewText ?? "", context, {
    escape: false,
  });

  const element = (
    <EmailLayout
      branding={branding}
      store={store}
      previewText={mergedPreview}
      html={mergedBody}
      context={context}
    />
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: mergedSubject, html, text };
}
