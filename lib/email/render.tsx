import {
  Body,
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

import type { BrandingSettings, Store } from "@/lib/db";
import { applyMergeFields, type MergeContext } from "./merge";

/**
 * Wraps a store's editable HTML body in a branded React Email layout.
 *
 * The body itself is admin-authored HTML with merge tokens; the surrounding
 * shell (colours, logo, font, footer) comes from `branding_settings`, so an
 * owner restyling the tracking page restyles their email at the same time.
 */
function EmailLayout({
  branding,
  store,
  previewText,
  html,
}: {
  branding: BrandingSettings | null;
  store: Pick<Store, "name" | "shopDomain">;
  previewText: string;
  html: string;
}) {
  const primary = branding?.primaryColor ?? "#111827";
  const background = branding?.backgroundColor ?? "#ffffff";
  const textColor = branding?.textColor ?? "#111827";
  const accent = branding?.accentColor ?? "#2563eb";
  const font =
    branding?.fontFamily ??
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const storeName = store.name ?? store.shopDomain;

  return (
    <Html lang="en">
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body
        style={{
          backgroundColor: "#f1f5f9",
          fontFamily: font,
          margin: 0,
          padding: "24px 0",
          color: textColor,
        }}
      >
        <Container
          style={{
            backgroundColor: background,
            borderRadius: 12,
            maxWidth: 560,
            margin: "0 auto",
            padding: "28px 32px",
          }}
        >
          <Section style={{ paddingBottom: 12 }}>
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
                  color: primary,
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {storeName}
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "8px 0 20px" }} />

          {/*
            Admin-authored body; merge values are HTML-escaped upstream.
            The raw HTML goes on an inner <div>, because React Email's
            <Section> renders its own children (a table wrapper) and React
            refuses both children and dangerouslySetInnerHTML on one element.
          */}
          <Section>
            <div
              style={{ fontSize: branding?.baseFontSize ?? 16, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />

          <Text style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
            {branding?.footerText?.trim()
              ? branding.footerText
              : `You are receiving this email because you placed an order with ${storeName}.`}
          </Text>
          {branding?.helpBannerUrl ? (
            <Text style={{ fontSize: 12, margin: "8px 0 0" }}>
              <Link href={branding.helpBannerUrl} style={{ color: accent }}>
                Need help with your order?
              </Link>
            </Text>
          ) : null}
        </Container>
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
    />
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: mergedSubject, html, text };
}
