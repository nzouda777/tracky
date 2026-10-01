import {
  Button,
  Container,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";

import { mutedOn, readableOn } from "@/components/tracking/branding";
import {
  MONO,
  EmailShell,
  authoredBody,
  eyebrowOf,
  mix,
  type EmailModel,
} from "./shared";

const PAPER = "#F1F2EF";

/**
 * Classic: a rounded card on a soft backdrop, the store's colour as a rule
 * across the top. The original Tracky layout, and the default.
 */
export function ClassicLayout({ model }: { model: EmailModel }) {
  const { accent, surface, text, link } = model;

  // Derived from the store's own colours rather than fixed greys, so a shop
  // with a dark or warm palette does not get a stack of neutral slate.
  const muted = mutedOn(text, surface);
  const hairline = mix(text, surface, 0.12);
  const panel = mix(text, surface, 0.04);

  const eyebrow = eyebrowOf(model);
  const body = authoredBody(model.html, { text, muted, link, size: model.size });

  return (
    <EmailShell model={model} background={PAPER}>
      <Section style={{ padding: "32px 12px 40px" }}>
        <Container
          style={{
            backgroundColor: surface,
            // The store's colour as a rule across the top. It is the
            // container's own border rather than a filled row: a row had to be
            // clipped to the rounded corners, which email clients decline to
            // do. A border follows the radius for free.
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
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
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
                {model.storeName}
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

            {model.stage ? (
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
                {model.stage}
              </Text>
            ) : null}
          </Section>

          {/* The raw HTML goes on an inner <div>, because <Section> renders
              its own children and React refuses both children and
              dangerouslySetInnerHTML on one element. */}
          <Section
            style={{ padding: `${model.stage || eyebrow ? 20 : 24}px 32px 0` }}
          >
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ padding: "24px 32px 0" }}>
              <Button
                href={model.trackingUrl}
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

          {model.address ? (
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
                <Text
                  style={{
                    color: text,
                    fontSize: 14,
                    lineHeight: "20px",
                    margin: 0,
                  }}
                >
                  {model.address}
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
              {model.orderNumber ? (
                <>
                  {" "}
                  and quote{" "}
                  <span style={{ fontFamily: MONO, color: text }}>
                    {model.orderNumber}
                  </span>
                </>
              ) : null}
              .
            </Text>
          </Section>
        </Container>

        {/* Boilerplate sits outside the card: it belongs to the mailing, not
            to the message. */}
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ padding: "20px 32px 0", textAlign: "center" }}>
            {model.helpUrl ? (
              <Text style={{ fontSize: 13, margin: "0 0 6px" }}>
                <Link
                  href={model.helpUrl}
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
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{
                  color: mutedOn(text, PAPER),
                  fontSize: 12,
                  lineHeight: "18px",
                  margin: "6px 0 0",
                }}
              >
                {model.postalAddress}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Section>
    </EmailShell>
  );
}
