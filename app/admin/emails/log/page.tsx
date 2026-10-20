import type { Metadata } from "next";
import Link from "next/link";

import { StatTile } from "@/components/admin/stat-tile";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import {
  countEmailSendsByStatus,
  getEmailSendDetail,
  getEmailVolumeStats,
  listEmailLog,
  parseEmailLogFilters,
  type EmailLogDetail,
  type EmailLogFilters,
  type EmailLogSearchParams,
  type EmailLogStatus,
} from "@/lib/email/log";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";
import { RetrySendButton } from "./retry-send-button";

export const metadata: Metadata = { title: "Email log" };

const TONES = {
  sent: "success",
  scheduled: "info",
  failed: "danger",
  skipped: "neutral",
} as const;

const PROVIDER_LABELS: Record<string, string> = {
  resend: "Resend",
  postal: "Postal",
};

/** A retired provider on an old row shows under its stored name. */
function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

const TABS: Array<{ status: EmailLogStatus; label: string }> = [
  { status: "failed", label: "Failed" },
  { status: "skipped", label: "Skipped" },
  { status: "sent", label: "Sent" },
  { status: "scheduled", label: "Scheduled" },
  { status: "all", label: "All" },
];

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<EmailLogSearchParams>;
}) {
  const { tdb } = await requireOwner();
  const filters = parseEmailLogFilters(await searchParams);

  const [counts, volume, { rows, total, page, perPage }, detail] = await Promise.all([
    countEmailSendsByStatus(tdb),
    getEmailVolumeStats(tdb),
    listEmailLog(tdb, filters),
    filters.view ? getEmailSendDetail(tdb, filters.view) : Promise.resolve(null),
  ]);
  const allCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const hasNarrowing =
    Boolean(filters.q || filters.from || filters.to) || filters.provider !== "all";

  // Every link keeps the active filters. Changing status starts over at page
  // one; opening or closing the detail panel stays on the current page.
  const href = (next: Partial<Pick<EmailLogFilters, "status" | "page" | "view">>) => {
    const query = new URLSearchParams();
    const status = next.status ?? filters.status;
    if (status !== "failed") query.set("status", status);
    if (filters.provider !== "all") query.set("provider", filters.provider);
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.q) query.set("q", filters.q);
    const pageNumber = next.page ?? (next.view !== undefined ? page : 1);
    if (pageNumber > 1) query.set("page", String(pageNumber));
    if (next.view) query.set("view", next.view);
    const search = query.toString();
    return `/admin/emails/log${search ? `?${search}` : ""}`;
  };

  const split = volume.providers30Days
    .map((entry) => `${providerLabel(entry.provider)} ${Math.round(entry.share * 100)}%`)
    .join(" / ");
  const postalShare =
    volume.providers30Days.find((entry) => entry.provider === "postal")?.share ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email log"
        description={
          counts.failed > 0
            ? `${counts.failed} email${counts.failed === 1 ? "" : "s"} could not be delivered to the provider.`
            : "Every customer email this store has scheduled, and what happened to it."
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Sent, last 7 days" value={volume.sentLast7Days} />
        <StatTile label="Sent, last 30 days" value={volume.sentLast30Days} />
        <StatTile
          label="Provider split, last 30 days"
          value={split || "—"}
          hint={
            volume.sentLast30Days === 0
              ? "Nothing sent in the last 30 days."
              : postalShare > 0
                ? "Postal takes over only when Resend hits a rate limit or quota."
                : "Everything went through Resend."
          }
        />
      </div>

      {detail ? <SendDetail detail={detail} closeHref={href({ view: "" })} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Status" className="flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const active = tab.status === filters.status;
            const value = tab.status === "all" ? allCount : counts[tab.status];
            return (
              <Link
                key={tab.status}
                href={href({ status: tab.status, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium",
                  active
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "text-xs",
                    active ? "text-white/70" : "text-ink-400",
                    tab.status === "failed" && value > 0 && !active && "text-red-600",
                  )}
                >
                  {value}
                </span>
              </Link>
            );
          })}
        </nav>

        <form action="/admin/emails/log" className="flex flex-wrap items-center gap-2">
          {filters.status !== "failed" ? (
            <input type="hidden" name="status" value={filters.status} />
          ) : null}
          <Select
            name="provider"
            defaultValue={filters.provider}
            aria-label="Provider"
            className="w-36"
          >
            <option value="all">All providers</option>
            <option value="resend">Resend</option>
            <option value="postal">Postal</option>
          </Select>
          <Input
            type="date"
            name="from"
            defaultValue={filters.from}
            aria-label="From date"
            className="w-40"
          />
          <Input
            type="date"
            name="to"
            defaultValue={filters.to}
            aria-label="To date"
            className="w-40"
          />
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Email, order or error…"
            aria-label="Search the email log"
            className="w-60"
          />
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={
              filters.status === "failed" && !hasNarrowing
                ? "No failed emails"
                : "Nothing matches"
            }
            description={
              filters.status === "failed" && !hasNarrowing
                ? "Every email handed to the provider so far was accepted."
                : "Try another status or clear the filters."
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Order</Th>
                <Th>Recipient</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Provider</Th>
                <Th>Message ID</Th>
                <Th>Error</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ send, templateName, orderNumber, stageName }) => (
                <tr
                  key={send.id}
                  className={cn(
                    "align-top hover:bg-ink-50",
                    send.id === filters.view && "bg-ink-50",
                  )}
                >
                  <Td className="whitespace-nowrap">
                    <span
                      className="block text-ink-900"
                      title={formatDateTime(send.updatedAt)}
                    >
                      {formatRelative(send.updatedAt)}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {send.sentAt
                        ? `sent ${formatDateTime(send.sentAt)}`
                        : `due ${formatDateTime(send.scheduledFor)}`}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${send.orderId}`}
                      className="font-medium text-ink-900 underline-offset-2 hover:underline"
                    >
                      {orderNumber ?? "Order"}
                    </Link>
                  </Td>
                  <Td className="text-ink-700">{send.toEmail}</Td>
                  <Td>
                    <span className="block text-ink-900">
                      {templateName ?? "Deleted template"}
                    </span>
                    {send.sequenceStepId === null ? (
                      <span className="text-xs text-ink-500">manual send</span>
                    ) : stageName ? (
                      <span className="text-xs text-ink-500">stage: {stageName}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={TONES[send.status]}>{send.status}</Badge>
                  </Td>
                  <Td>
                    {send.provider ? (
                      <Badge tone={send.provider === "postal" ? "warning" : "info"}>
                        {providerLabel(send.provider)}
                      </Badge>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {send.providerMessageId ? (
                      <code
                        className="font-mono text-xs text-ink-600"
                        title={send.providerMessageId}
                      >
                        {truncateId(send.providerMessageId)}
                      </code>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td className="max-w-md">
                    {send.error ? (
                      <p
                        className={cn(
                          "line-clamp-3 break-words text-xs",
                          send.status === "failed" ? "text-red-600" : "text-ink-500",
                        )}
                        title={send.error}
                      >
                        {send.error}
                      </p>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        href={href({ view: send.id })}
                        scroll={false}
                        className="text-xs font-medium text-ink-700 underline underline-offset-2"
                      >
                        Details
                      </Link>
                      {send.status === "failed" || send.status === "skipped" ? (
                        <RetrySendButton sendId={send.id} />
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {lastPage > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="font-medium text-ink-700 underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-ink-300">← Previous</span>
          )}
          <span className="text-ink-500">
            {(page - 1) * perPage + 1}&ndash;{Math.min(page * perPage, total)} of{" "}
            {total} &middot; page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={href({ page: page + 1 })} className="font-medium text-ink-700 underline">
              Next
            </Link>
          ) : (
            <span className="text-ink-300">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function truncateId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-6)}` : id;
}

const TRIGGER_LABELS: Record<string, string> = {
  on_stage: "On stage change",
  delay_after_order: "Days after order",
  delay_after_previous: "Days after previous email",
};

/** Everything recorded about one send. Read-only: the retry lives in the table. */
function SendDetail({
  detail,
  closeHref,
}: {
  detail: EmailLogDetail;
  closeHref: string;
}) {
  const { send } = detail;
  const step =
    send.sequenceStepId === null
      ? "Manual send"
      : detail.triggerType
        ? [
            TRIGGER_LABELS[detail.triggerType] ?? detail.triggerType,
            detail.stageName,
            detail.delayDays !== null ? `${detail.delayDays} day(s)` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Sequence step deleted";

  const fields: Array<[string, React.ReactNode]> = [
    ["Status", <Badge key="status" tone={TONES[send.status]}>{send.status}</Badge>],
    ["Provider", send.provider ? providerLabel(send.provider) : "—"],
    [
      "Provider message ID",
      send.providerMessageId ? (
        <code key="id" className="break-all font-mono text-xs">
          {send.providerMessageId}
        </code>
      ) : (
        "—"
      ),
    ],
    ["Recipient", send.toEmail],
    ["Subject", send.subject ?? "—"],
    ["Template", detail.templateName ?? "Deleted template"],
    ["Sequence step", step],
    [
      "Order",
      <Link
        key="order"
        href={`/admin/orders/${send.orderId}`}
        className="font-medium underline-offset-2 hover:underline"
      >
        {detail.orderNumber ?? "Order"}
      </Link>,
    ],
    ["Scheduled for", formatDateTime(send.scheduledFor)],
    ["Sent at", formatDateTime(send.sentAt)],
    ["Created", formatDateTime(send.createdAt)],
    ["Last updated", formatDateTime(send.updatedAt)],
    ["Send ID", <code key="send" className="break-all font-mono text-xs">{send.id}</code>],
  ];

  return (
    <Card>
      <CardHeader
        title="Email details"
        description={`${send.toEmail} · ${detail.templateName ?? "Deleted template"}`}
        action={
          <Link
            href={closeHref}
            scroll={false}
            className="text-sm font-medium text-ink-700 underline underline-offset-2"
          >
            Close
          </Link>
        }
      />
      <dl className="grid gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-ink-500">{label}</dt>
            <dd className="mt-0.5 break-words text-ink-900">{value}</dd>
          </div>
        ))}
        {send.error ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-ink-500">
              {send.status === "failed" ? "Error" : "Note"}
            </dt>
            <dd
              className={cn(
                "mt-0.5 whitespace-pre-wrap break-words text-xs",
                send.status === "failed" ? "text-red-600" : "text-ink-600",
              )}
            >
              {send.error}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}
