import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

import { BRANDING_FALLBACK, readableOn } from "@/components/tracking/branding";
import type { BrandingSettings, Store } from "@/lib/db";
import { applyMergeFields, type MergeContext } from "./merge";

/**
 * Wraps a store's editable HTML body in a branded React Email layout.
 *
 * The body itself is admin-authored HTML with merge tokens; the surrounding
 * shell — logo, status block, manifest, footer — comes from `branding_settings`
 * and the merge context, so an owner restyling the tracking page restyles
 * their email at the same time and the two never disagree.
 *
 * The status block is a light tint of the store's accent rather than a
 * saturated band. A bright coloured block is how a shipping email signals
 * progress it has not actually been told about; this one only ever names the
 * stage the order is really in.
 */
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
  const textColor = branding?.textColor ?? BRANDING_FALLBACK.textColor;
  const link = branding?.accentColor ?? BRANDING_FALLBACK.accentColor;
  const font = emailFont(branding?.fontFamily);
  const storeName = store.name ?? store.shopDomain;

  const stage = context.current_stage?.trim();
  const orderNumber = context.order_number?.trim();
  const trackingUrl = context.tracking_link?.trim();

  return (
    <Html lang="en">
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body
        style={{
          backgroundColor: PAPER,
          fontFamily: font,
          margin: 0,
          padding: "24px 0",
          color: textColor,
        }}
      >
        <Container
          style={{
            backgroundColor: surface,
            borderRadius: 10,
            maxWidth: 560,
            margin: "0 auto",
            padding: "28px 32px",
          }}
        >
          <Section style={{ paddingBottom: 16 }}>
            {branding?.logoUrl ? (
              <Img
                src={branding.logoUrl}
                alt={storeName}
                height={36}
                style={{ display: "block", maxHeight: 36 }}
              />
            ) : (
              <Text
                style={{
                  color: accent,
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {storeName}
              </Text>
            )}
          </Section>

          {stage ? (
            <Section
              style={{
                backgroundColor: tint(accent),
                borderRadius: 10,
                padding: "16px 20px",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: accent,
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: "26px",
                  margin: 0,
                }}
              >
                {stage}
              </Text>
              {orderNumber ? (
                <Text
                  style={{
                    color: textColor,
                    fontSize: 14,
                    lineHeight: "20px",
                    margin: "4px 0 0",
                  }}
                >
                  Order{" "}
                  <span style={{ fontFamily: MONO, fontWeight: 500 }}>
                    {orderNumber}
                  </span>
                </Text>
              ) : null}
            </Section>
          ) : null}

          {/*
            Admin-authored body; merge values are HTML-escaped upstream.
            The raw HTML goes on an inner <div>, because React Email's
            <Section> renders its own children (a table wrapper) and React
            refuses both children and dangerouslySetInnerHTML on one element.
          */}
          <Section>
            <div
              style={{
                fontSize: branding?.baseFontSize ?? 16,
                lineHeight: 1.625,
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Section>

          {trackingUrl ? (
            <Section style={{ paddingTop: 20 }}>
              <Link
                href={trackingUrl}
                style={{
                  backgroundColor: accent,
                  borderRadius: 4,
                  color: readableOn(accent, textColor),
                  display: "inline-block",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "11px 20px",
                  textDecoration: "none",
                }}
              >
                Track your order
              </Link>
            </Section>
          ) : null}

          <Hr style={{ borderColor: LINE, margin: "24px 0 12px" }} />

          {/* A condensed manifest: label left, value right, the same shape as
              the one on the tracking page. */}
          <ManifestRow label="Order" value={orderNumber} mono />
          <ManifestRow label="Ship to" value={context.shipping_address} />

          <Hr style={{ borderColor: LINE, margin: "12px 0" }} />

          <Text style={{ color: MUTED, fontSize: 13, margin: 0 }}>
            {branding?.footerText?.trim()
              ? branding.footerText
              : `You are receiving this email because you placed an order with ${storeName}.`}
          </Text>
          {branding?.helpBannerUrl ? (
            <Text style={{ fontSize: 13, margin: "8px 0 0" }}>
              <Link href={branding.helpBannerUrl} style={{ color: link }}>
                Need help with your order?
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

const PAPER = "#F4F5F3";
const LINE = "#E2E4E0";
const MUTED = "#6B7280";
const MONO = "'Spline Sans Mono', ui-monospace, SFMono-Regular, monospace";
const EMAIL_FALLBACK_FONT =
  "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * The store's font stack, made safe for email.
 *
 * On the web the default stack starts with `var(--font-archivo)`, which
 * next/font fills in. An email client has no such variable and some drop the
 * entire declaration when they meet one, leaving the message in Times. So the
 * variable is swapped for the family's real name and the rest of the stack is
 * kept as the fallback it already was.
 */
function emailFont(stack: string | null | undefined): string {
  if (!stack?.trim()) return EMAIL_FALLBACK_FONT;

  const resolved = stack.replace(/var\(\s*--font-archivo\s*\)/g, "Archivo");
  // Any other custom property is unknowable here; fall back rather than ship a
  // declaration the client will discard.
  return /var\(/.test(resolved) ? EMAIL_FALLBACK_FONT : resolved;
}

/**
 * A light wash of the store's accent.
 *
 * `color-mix` is not safe in email clients, so this is computed here rather
 * than left to CSS. An unparseable colour falls back to paper, which is never
 * wrong — just plain.
 */
function tint(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return PAPER;

  const value = Number.parseInt(match[1], 16);
  const mix = (channel: number) => Math.round(channel * 0.09 + 255 * 0.91);
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function ManifestRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  if (!value?.trim()) return null;

  return (
    <Row style={{ marginBottom: 4 }}>
      <Column style={{ color: MUTED, fontSize: 13, verticalAlign: "top" }}>
        {label}
      </Column>
      <Column
        style={{
          fontSize: 13,
          fontFamily: mono ? MONO : undefined,
          textAlign: "right",
          verticalAlign: "top",
        }}
      >
        {value}
      </Column>
    </Row>
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
