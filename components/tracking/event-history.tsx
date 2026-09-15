import type { PublicOrderView } from "@/lib/tracking/lookup";
import { formatDateTime, formatRelative } from "@/lib/utils";

type Entry = PublicOrderView["events"][number];

/**
 * The customer's event history, newest first.
 *
 * The newest entry is promoted into its own panel, because that is the one
 * thing most visitors came to read; everything older is listed beneath it as
 * plain ruled rows.
 *
 * Every row is a row in `order_stage_history` — a webhook, or something a
 * named person recorded. There is no synthesised "in transit" filler, which is
 * why a quiet order simply shows fewer rows rather than invented ones. The
 * panel is deliberately unfilled: a tinted status block is what a page uses to
 * look busy when it has nothing new to say.
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

  return (
    <section>
      <h2 className="text-h3 font-semibold">Latest update</h2>

      <div
        className="mt-3 rounded-panel px-4 py-3.5"
        style={{ border: "1px solid var(--brand-line)" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-h3 font-semibold">
            {latest.stage?.name ?? "Update"}
          </h3>
          <Stamp at={latest.event.occurredAt} />
        </div>

        {latest.event.note || latest.stage?.description ? (
          <p className="mt-1.5 text-body" style={{ color: "var(--brand-muted)" }}>
            {latest.event.note || latest.stage?.description}
          </p>
        ) : null}

        {deliveredNote ? (
          <p className="mt-1.5 text-body" style={{ color: "var(--brand-muted)" }}>
            {deliveredNote}
          </p>
        ) : null}
      </div>

      {rest.length > 0 ? (
        <ol className="mt-5">
          {rest.map((entry) => (
            <li
              key={entry.event.id}
              className="border-b py-2.5 last:border-b-0"
              style={{ borderColor: "var(--brand-line)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <p className="text-small font-medium">
                  {entry.stage?.name ?? "Update"}
                </p>
                <Stamp at={entry.event.occurredAt} />
              </div>

              {entry.event.note || entry.stage?.description ? (
                <p
                  className="mt-0.5 text-small"
                  style={{ color: "var(--brand-muted)" }}
                >
                  {entry.event.note || entry.stage?.description}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** Times are real codes, so they are set in mono and line up down the column. */
function Stamp({ at }: { at: Date }) {
  return (
    <time
      dateTime={at.toISOString()}
      className="type-code shrink-0 text-caption"
      style={{ color: "var(--brand-muted)" }}
      title={formatRelative(at)}
    >
      {formatDateTime(at)}
    </time>
  );
}
