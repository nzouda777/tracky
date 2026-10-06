import {
  Button,
  Column,
  Container,
  Img,
  Row,
  Section,
  Text,
} from "@react-email/components";

import {
  HOOMA_THEMES,
  resolveHoomaOptions,
  type HoomaOptions,
} from "./hooma-options";
import {
  EmailShell,
  authoredBody,
  mix,
  visibleOn,
  type EmailModel,
} from "./shared";

const PAGE = "#F6F6F6";
const WHITE = "#FFFFFF";
const INK = "#111827";
const BODY = "#4B5563";
const LABEL = "#6B7280";
const CARD = "#F9FAFB";
const HAIRLINE = "#E5E7EB";
const FAINT = "#9CA3AF";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";

type Theme = {
  heroFrom: string;
  heroTo: string;
  solid: string;
  title: string;
  noteBg: string;
  noteBorder: string;
  noteText: string;
  button: string;
};

/** A preset palette, or one derived from the store's brand colour. */
function themeFor(options: HoomaOptions, accent: string): Theme {
  if (options.theme !== "brand") return HOOMA_THEMES[options.theme];

  const solid = visibleOn(accent, WHITE, INK);
  const title = mix(solid, "#000000", 0.75);
  return {
    heroFrom: mix(solid, WHITE, 0.05),
    heroTo: mix(solid, WHITE, 0.14),
    solid,
    title,
    noteBg: mix(solid, WHITE, 0.05),
    noteBorder: mix(solid, WHITE, 0.3),
    noteText: title,
    button: solid,
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: INK,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: "20px",
        textTransform: "uppercase",
        margin: "0 0 14px",
      }}
    >
      {children}
    </Text>
  );
}

function FactRow({
  label,
  value,
  strong = true,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Row>
      <Column style={{ verticalAlign: "top", padding: "0 12px 0 0" }}>
        <Text
          style={{ color: LABEL, fontSize: 14, lineHeight: "22px", margin: 0 }}
        >
          {label}
        </Text>
      </Column>
      <Column style={{ verticalAlign: "top", textAlign: "right" }}>
        <Text
          style={{
            color: strong ? INK : BODY,
            fontSize: strong ? 15 : 14,
            fontWeight: strong ? 700 : 400,
            letterSpacing: strong ? "0.02em" : 0,
            lineHeight: "22px",
            margin: 0,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
}

/**
 * Hooma: a logo on a soft grey page, then a white column topped by a pastel
 * gradient hero — a coloured circle with an icon, the status as a headline and
 * one line under it. Below: an optional "next update" note, the greeting, the
 * message, the order facts in a grey card, the items and the address.
 *
 * Every word and colour of the shell comes from the template's own settings
 * (see `hooma-options.ts`), so a confirmation can be green with a tick and a
 * delivery update blue with a parcel.
 */
export function HoomaLayout({ model }: { model: EmailModel }) {
  const options = resolveHoomaOptions(model.designOptions);
  const theme = themeFor(options, model.accent);
  const order = model.order;
  const isTick = options.icon.trim() === "✓";

  const body = authoredBody(model.html, {
    text: BODY,
    muted: LABEL,
    link: theme.button,
    size: 15,
  });

  const orderCard = options.showOrderCard ? (
    <Section style={{ padding: "0 18px" }}>
      <Section
        style={{
          backgroundColor: CARD,
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 12,
          padding: "10px 18px",
        }}
      >
        {model.orderNumber ? (
          <FactRow label="Order Number" value={model.orderNumber} />
        ) : null}
        {options.showTotal && order?.total ? (
          <FactRow label="Total" value={order.total} />
        ) : null}
        <FactRow
          label="Order Date"
          value={order?.placedAt || model.orderDate || "—"}
          strong={false}
        />
      </Section>
    </Section>
  ) : null;

  const greetingAndMessage = (
    <Section style={{ padding: "0 18px" }}>
      {options.greeting ? (
        <Text
          style={{
            color: INK,
            fontSize: 17,
            fontWeight: 700,
            lineHeight: "24px",
            margin: "0 0 6px",
          }}
        >
          {options.greeting}
        </Text>
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </Section>
  );

  const items = order?.items ?? [];
  const addressLines =
    order?.addressLines.length
      ? order.addressLines
      : model.address
        ? [model.address]
        : [];

  return (
    <EmailShell model={model} background={PAGE} font={SANS}>
      <Container style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Logo on the grey page. */}
        <Section style={{ padding: "30px 24px 30px", textAlign: "center" }}>
          {model.logoUrl ? (
            <Img
              src={model.logoUrl}
              alt={model.storeName}
              style={{
                display: "block",
                margin: "0 auto",
                maxHeight: 40,
                maxWidth: 200,
                height: "auto",
              }}
            />
          ) : (
            <Text
              style={{
                color: INK,
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: "40px",
                margin: 0,
              }}
            >
              {model.storeName}
            </Text>
          )}
        </Section>

        <Section style={{ padding: "0 24px" }}>
          <Section
            style={{
              backgroundColor: WHITE,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Hero */}
            <Section
              style={{
                backgroundColor: theme.heroTo,
                backgroundImage: `linear-gradient(135deg, ${theme.heroFrom} 0%, ${theme.heroTo} 100%)`,
                borderRadius: "20px 20px 0 0",
                padding: "28px 24px 26px",
                textAlign: "center",
              }}
            >
              {options.icon ? (
                <div
                  style={{
                    backgroundColor: theme.solid,
                    borderRadius: "50%",
                    color: WHITE,
                    fontSize: isTick ? 26 : 22,
                    fontWeight: isTick ? 300 : 400,
                    height: 48,
                    lineHeight: "48px",
                    margin: "0 auto",
                    textAlign: "center",
                    width: 48,
                  }}
                >
                  {options.icon}
                </div>
              ) : null}
              {options.heroTitle ? (
                <Text
                  style={{
                    color: theme.title,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    lineHeight: "28px",
                    margin: options.icon ? "16px 0 0" : 0,
                  }}
                >
                  {options.heroTitle}
                </Text>
              ) : null}
              {options.heroSubtitle ? (
                <Text
                  style={{
                    color: BODY,
                    fontSize: 15,
                    lineHeight: "21px",
                    margin: "10px 0 0",
                  }}
                >
                  {options.heroSubtitle}
                </Text>
              ) : null}
            </Section>

            {options.nextUpdate ? (
              <Section style={{ padding: "20px 18px 0" }}>
                <Section
                  style={{
                    backgroundColor: theme.noteBg,
                    border: `1px solid ${theme.noteBorder}`,
                    borderRadius: 12,
                    padding: "9px 18px",
                  }}
                >
                  <Text
                    style={{
                      color: theme.noteText,
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: "20px",
                      margin: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        marginRight: 10,
                        verticalAlign: "-2px",
                      }}
                    >
                      🕐
                    </span>
                    {options.nextUpdate}
                  </Text>
                </Section>
              </Section>
            ) : null}

            {/* The card sits under the hero or under the message. */}
            {options.orderCardFirst && orderCard ? (
              <>
                <Spacer height={20} />
                {orderCard}
                <Spacer height={40} />
                {greetingAndMessage}
              </>
            ) : (
              <>
                <Spacer height={options.nextUpdate ? 40 : 28} />
                {greetingAndMessage}
                {orderCard ? (
                  <>
                    <Spacer height={36} />
                    {orderCard}
                  </>
                ) : null}
              </>
            )}

            {options.showItems && items.length > 0 ? (
              <Section style={{ padding: "40px 18px 0" }}>
                <SectionHeading>Items</SectionHeading>
                {items.map((item, index) => (
                  <Row
                    key={index}
                    style={{
                      borderTop: index === 0 ? "none" : `1px solid ${HAIRLINE}`,
                    }}
                  >
                    <Column style={{ padding: "10px 12px 10px 0", verticalAlign: "top" }}>
                      <Text
                        style={{
                          color: INK,
                          fontSize: 15,
                          fontWeight: 600,
                          lineHeight: "21px",
                          margin: 0,
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{
                          color: LABEL,
                          fontSize: 13,
                          lineHeight: "19px",
                          margin: "2px 0 0",
                        }}
                      >
                        {[item.variant, `Qty: ${item.quantity}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Column>
                    <Column
                      style={{
                        padding: "10px 0",
                        textAlign: "right",
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Text
                        style={{
                          color: INK,
                          fontSize: 15,
                          fontWeight: 600,
                          lineHeight: "21px",
                          margin: 0,
                        }}
                      >
                        {item.price}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>
            ) : null}

            {options.showAddress && addressLines.length > 0 ? (
              <Section style={{ padding: "40px 18px 0" }}>
                <SectionHeading>Delivery Address</SectionHeading>
                {addressLines.map((line, index) => (
                  <Text
                    key={index}
                    style={{
                      color: BODY,
                      fontSize: 15,
                      lineHeight: "22px",
                      margin: 0,
                    }}
                  >
                    {line}
                  </Text>
                ))}
              </Section>
            ) : null}

            {options.buttonLabel && model.trackingUrl ? (
              <Section style={{ padding: "36px 18px 0" }}>
                <Button
                  href={model.trackingUrl}
                  style={{
                    backgroundColor: theme.button,
                    borderRadius: 12,
                    color: visibleOn(WHITE, theme.button, INK),
                    display: "block",
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "14px 20px",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  {options.buttonLabel}
                </Button>
              </Section>
            ) : null}

            {options.footerNote ? (
              <Section style={{ padding: "28px 18px 0", textAlign: "center" }}>
                <Text
                  style={{
                    color: LABEL,
                    fontSize: 14,
                    lineHeight: "20px",
                    margin: 0,
                  }}
                >
                  {options.footerNote}
                </Text>
              </Section>
            ) : null}

            <Spacer height={32} />
          </Section>
        </Section>

        {/* Legal footer on the grey page. */}
        <Section style={{ padding: "24px 32px 40px", textAlign: "center" }}>
          <Text
            style={{ color: FAINT, fontSize: 12, lineHeight: "18px", margin: 0 }}
          >
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text
              style={{
                color: FAINT,
                fontSize: 12,
                lineHeight: "18px",
                margin: "4px 0 0",
              }}
            >
              {model.postalAddress}
            </Text>
          ) : null}
          <Text
            style={{
              color: FAINT,
              fontSize: 12,
              lineHeight: "18px",
              margin: "4px 0 0",
            }}
          >
            © {new Date().getFullYear()} {model.storeName}
          </Text>
        </Section>
      </Container>
    </EmailShell>
  );
}

function Spacer({ height }: { height: number }) {
  return (
    <Section>
      <div style={{ fontSize: 0, height, lineHeight: `${height}px` }}>&nbsp;</div>
    </Section>
  );
}
