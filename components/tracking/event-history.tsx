import type { PublicOrderView } from "@/lib/tracking/lookup";
import { formatDateTime, formatRelative } from "@/lib/utils";

type Entry = PublicOrderView["events"][number];

/**
 * The customer's event history, newest first, drawn as a vertical timeline.
 *
 * The newest entry is the "Last update" card — a green clock on the rail and
 * a tinted header above the card — because that is the one thing most
 * visitors came to read. Every older entry hangs off the same rail with a
 * grey tick, its title and timestamp on one line and its wording beneath.
 * The oldest entry is set a shade lighter, where the journey began.
 *
 * Every row is a row in `order_stage_history` — a webhook, or something a
 * named person recorded. There is no synthesised filler, which is why a quiet
 * order simply shows fewer rows rather than invented ones.
 *
 * Styled inline, like the progress bar, so it renders the same embedded in a
 * Shopify theme as on our own domain.
 */
export function EventHistory({
  events,
  proof,
}: {
  events: Entry[];
  /** Set once delivery is confirmed; adds who took it and when. */
  proof?: PublicOrderView["proof"];
}) {
  if (events.length === 0) {
    return (
      <p className="text-small" style={{ color: "var(--brand-muted)" }}>
        No updates recorded yet.
      </p>
    );
  }

  const [latest, ...rest] = events;

  const deliveredNote = proof
    ? `Delivered ${formatDateTime(proof.deliveredAt)}${
        proof.recipientName ? `, signed for by ${proof.recipientName}` : ""
      }.`
    : null;

  const latestText = latest.event.note || latest.stage?.description;

  return (
    <section data-part="events" style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
        <div style={RAIL_COLUMN}>
          <span
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "50%",
              backgroundColor: "var(--brand-delivered)",
              boxShadow: `0 0 0 4px ${GREEN_TINT}`,
              color: "#fff",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M8 5v3.2l2 1.3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {rest.length > 0 ? (
            <span
              aria-hidden
              style={{
                width: 2,
                height: 36,
                margin: "6px 0 2px",
                background: `linear-gradient(to bottom, color-mix(in srgb, var(--brand-delivered) 40%, var(--brand-surface)), transparent)`,
              }}
            />
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0, marginBottom: 12 }}>
          <div
            style={{
              backgroundColor: GREEN_TINT,
              borderRadius: "10px 10px 0 0",
              padding: "5px 12px",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--brand-delivered)",
              }}
            >
              Last update
            </span>
          </div>
          <div
            style={{
              backgroundColor: "var(--brand-panel)",
              borderRadius: "0 0 10px 10px",
              padding: "8px 12px 10px",
            }}
          >
            <Row>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {latest.stage?.name ?? "Update"}
              </p>
              <Stamp at={latest.event.occurredAt} />
            </Row>
            {latestText ? <Desc>{latestText}</Desc> : null}
            {deliveredNote ? <Desc>{deliveredNote}</Desc> : null}
          </div>
        </div>
      </div>

      {rest.length > 0 ? (
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {rest.map((entry, index) => {
            const last = index === rest.length - 1;
            const text = entry.event.note || entry.stage?.description;

            return (
              <li key={entry.event.id} style={{ display: "flex", gap: 12 }}>
                <div style={RAIL_COLUMN}>
                  <span
                    aria-hidden
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      margin: 2,
                      borderRadius: "50%",
                      backgroundColor: GREY_DOT,
                      color: "#fff",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8l3.5 3.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {last ? null : (
                    <span
                      aria-hidden
                      style={{
                        width: 2,
                        flex: 1,
                        margin: "4px 0 2px",
                        backgroundColor: "var(--brand-line)",
                      }}
                    />
                  )}
                </div>

                <div
                  style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 14 }}
                >
                  <Row height={30}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: last
                          ? "var(--brand-muted)"
                          : "color-mix(in srgb, var(--brand-text) 75%, var(--brand-surface))",
                      }}
                    >
                      {entry.stage?.name ?? "Update"}
                    </p>
                    <Stamp at={entry.event.occurredAt} />
                  </Row>
                  {text ? <Desc faded={last}>{text}</Desc> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

const GREEN_TINT =
  "color-mix(in srgb, var(--brand-delivered) 13%, var(--brand-surface))";
const GREY_DOT =
  "color-mix(in srgb, var(--brand-text) 20%, var(--brand-surface))";

const RAIL_COLUMN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flexShrink: 0,
};

function Row({
  children,
  height,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: height,
      }}
    >
      {children}
    </div>
  );
}

function Desc({
  children,
  faded,
}: {
  children: React.ReactNode;
  faded?: boolean;
}) {
  return (
    <p
      style={{
        margin: "2px 0 0",
        fontSize: 13,
        lineHeight: 1.45,
        color: "var(--brand-muted)",
        opacity: faded ? 0.8 : 1,
      }}
    >
      {children}
    </p>
  );
}

/** Times are real codes, so they are set in mono and line up down the column. */
function Stamp({ at }: { at: Date }) {
  return (
    <time
      dateTime={at.toISOString()}
      className="type-code"
      style={{
        flexShrink: 0,
        fontSize: 12,
        whiteSpace: "nowrap",
        color: "var(--brand-muted)",
      }}
      title={formatRelative(at)}
    >
      {formatStamp(at)}
    </time>
  );
}

/** "Aug 6, 2026 · 14:52" — the carrier-style stamp. */
function formatStamp(at: Date): string {
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  return `${day} · ${time}`;
}
