import {
  Button,
  Container,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";

import {
  EmailShell,
  SERIF,
  authoredBody,
  eyebrowOf,
  type EmailModel,
} from "./shared";

const IVORY = "#F4F0EA";
const INK = "#1F1B16";
const MUTED = "#7A6F62";
const RULE = "#D9D1C5";

const smallCaps = {
  color: MUTED,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.24em",
  textTransform: "uppercase" as const,
};

function Rule({ width = 48, margin = "0 auto" }: { width?: number | string; margin?: string }) {
  return (
    <div
      style={{
        width,
        borderTop: `1px solid ${RULE}`,
        margin,
        fontSize: 0,
        lineHeight: 0,
      }}
    >
      &nbsp;
    </div>
  );
}

/**
 * Editorial: a magazine page rather than a notification. Serif headline,
 * everything centred on warm ivory, fine rules instead of boxes.
 *
 * The page carries its own palette; the store's colour is used only for links,
 * where it reads as a deliberate accent instead of fighting the ivory.
 */
export function EditorialLayout({ model }: { model: EmailModel }) {
  const eyebrow = eyebrowOf(model, "   —   ");
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: model.link,
    size: model.size + 1,
    headingFont: SERIF,
  });

  return (
    <EmailShell model={model} background={IVORY}>
      <Section style={{ padding: "48px 16px 56px" }}>
        <Container style={{ maxWidth: 540, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", padding: "0 0 36px" }}>
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{
                  display: "inline-block",
                  maxHeight: 30,
                  maxWidth: 170,
                  height: "auto",
                }}
              />
            ) : (
              <Text
                style={{
                  color: INK,
                  fontFamily: SERIF,
                  fontSize: 22,
                  letterSpacing: "0.02em",
                  margin: 0,
                }}
              >
                {model.storeName}
              </Text>
            )}
          </Section>

          <Rule width="100%" />

          <Section style={{ textAlign: "center", padding: "52px 8px 0" }}>
            {eyebrow ? (
              <Text style={{ ...smallCaps, margin: "0 0 20px" }}>{eyebrow}</Text>
            ) : null}
            <Text
              style={{
                color: INK,
                fontFamily: SERIF,
                fontSize: 42,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                lineHeight: "48px",
                margin: 0,
              }}
            >
              {model.stage || "An update on your order"}
            </Text>
            <Rule margin="32px auto 0" />
          </Section>

          <Section style={{ textAlign: "center", padding: "32px 12px 0" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ textAlign: "center", padding: "36px 0 0" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: INK,
                  borderRadius: 0,
                  color: IVORY,
                  display: "inline-block",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  padding: "17px 34px",
                  textDecoration: "none",
                  textTransform: "uppercase",
                }}
              >
                Follow your order
              </Button>
            </Section>
          ) : null}

          {model.address ? (
            <Section style={{ textAlign: "center", padding: "48px 24px 0" }}>
              <Text style={{ ...smallCaps, margin: "0 0 10px" }}>Delivering to</Text>
              <Text
                style={{
                  color: INK,
                  fontFamily: SERIF,
                  fontSize: 17,
                  fontStyle: "italic",
                  lineHeight: "26px",
                  margin: 0,
                }}
              >
                {model.address}
              </Text>
            </Section>
          ) : null}

          <Section style={{ padding: "52px 0 0" }}>
            <Rule width="100%" />
          </Section>

          <Section style={{ textAlign: "center", padding: "28px 16px 0" }}>
            <Text
              style={{
                color: INK,
                fontFamily: SERIF,
                fontSize: 16,
                fontStyle: "italic",
                lineHeight: "24px",
                margin: "0 0 18px",
              }}
            >
              With care, {model.storeName}
            </Text>
            {model.helpUrl ? (
              <Text style={{ ...smallCaps, margin: "0 0 14px" }}>
                <Link href={model.helpUrl} style={{ color: INK, textDecoration: "none" }}>
                  Client care
                </Link>
              </Text>
            ) : null}
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: 0 }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: "6px 0 0" }}
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
