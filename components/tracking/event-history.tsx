import type { PublicOrderView } from "@/lib/tracking/lookup";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { StageIcon } from "./stage-icon";

type Entry = PublicOrderView["events"][number];

/**
 * The customer's event history, newest first.
 *
 * The newest entry is promoted into a highlighted "Latest update" card,
 * because that is the one thing most visitors came to read; everything older
 * runs down a vertical rail beneath it.
 *
 * Every row is a row in `order_stage_history` — a webhook, or something a
 * named person recorded. There is no synthesised "in transit" filler, which is
 * why a quiet order simply shows fewer rows rather than invented ones.
 */
export function EventHistory({
  events,
  deliveredNote,
}: {
  events: Entry[];
  /** Extra line under the latest update once delivery is confirmed. */
  deliveredNote?: string | null;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--brand-muted)" }}>
        No updates recorded yet.
      </p>
    );
  }

  const [latest, ...rest] = events;

  return (
    <div>
      <LatestUpdate entry={latest} deliveredNote={deliveredNote} />

      {rest.length > 0 ? (
        <ol className="mt-1">
          {rest.map((entry, index) => (
            <HistoryRow
              key={entry.event.id}
              entry={entry}
              isLast={index === rest.length - 1}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function LatestUpdate({
  entry,
  deliveredNote,
}: {
  entry: Entry;
  deliveredNote?: string | null;
}) {
  // One hue, matching the stepper: the state is the message here, not which
  // stage it was. See the note in stage-timeline.tsx.
  const colour = "var(--brand-primary)";

  return (
    <div className="relative flex gap-3.5">
      <Rail>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: colour, color: "var(--brand-background)" }}
        >
          <StageIcon name={entry.stage?.icon ?? "clock"} className="size-[18px]" />
        </span>
      </Rail>

      <div className="min-w-0 flex-1 pb-6">
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: "1px solid var(--brand-border)" }}
        >
          <p
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `color-mix(in srgb, ${colour} 10%, var(--brand-background))`,
              color: colour,
            }}
          >
            Latest update
          </p>

          <div className="px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[15px] font-semibold">
                {entry.stage?.name ?? "Update"}
              </p>
              <time
                dateTime={entry.event.occurredAt.toISOString()}
                className="shrink-0 text-xs"
                style={{ color: "var(--brand-muted)" }}
                title={formatRelative(entry.event.occurredAt)}
              >
                {formatDateTime(entry.event.occurredAt)}
              </time>
            </div>

            {entry.event.note || entry.stage?.description ? (
              <p className="mt-1.5 text-sm leading-relaxed">
                {entry.event.note || entry.stage?.description}
              </p>
            ) : null}

            {deliveredNote ? (
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--brand-muted)" }}
              >
                {deliveredNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ entry, isLast }: { entry: Entry; isLast: boolean }) {
  return (
    <li className="relative flex gap-3.5">
      <Rail hideLine={isLast}>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: "var(--brand-surface)",
            color: "var(--brand-muted)",
            border: "1px solid var(--brand-border)",
          }}
        >
          <StageIcon name="check" className="size-4" />
        </span>
      </Rail>

      <div className={`min-w-0 flex-1 ${isLast ? "pb-1" : "pb-6"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-[15px] font-semibold">
            {entry.stage?.name ?? "Update"}
          </p>
          <time
            dateTime={entry.event.occurredAt.toISOString()}
            className="shrink-0 text-xs"
            style={{ color: "var(--brand-muted)" }}
            title={formatRelative(entry.event.occurredAt)}
          >
            {formatDateTime(entry.event.occurredAt)}
          </time>
        </div>

        {entry.event.note || entry.stage?.description ? (
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: "var(--brand-muted)" }}
          >
            {entry.event.note || entry.stage?.description}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** The badge column, with the vertical line that joins one entry to the next. */
function Rail({
  children,
  hideLine,
}: {
  children: React.ReactNode;
  hideLine?: boolean;
}) {
  return (
    <div className="relative flex shrink-0 flex-col items-center">
      {children}
      {hideLine ? null : (
        <span
          aria-hidden
          className="w-px flex-1"
          style={{ backgroundColor: "var(--brand-border)" }}
        />
      )}
    </div>
  );
}
