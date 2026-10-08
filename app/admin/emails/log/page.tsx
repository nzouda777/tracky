import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import {
  countEmailSendsByStatus,
  listEmailLog,
  parseEmailLogFilters,
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

  const [counts, { rows, total, page, perPage }] = await Promise.all([
    countEmailSendsByStatus(tdb),
    listEmailLog(tdb, filters),
  ]);
  const allCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const href = (next: Partial<{ status: string; q: string; page: number }>) => {
    const query = new URLSearchParams();
    const status = next.status ?? filters.status;
    const q = next.q ?? filters.q;
    if (status !== "failed") query.set("status", status);
    if (q) query.set("q", q);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const search = query.toString();
    return `/admin/emails/log${search ? `?${search}` : ""}`;
  };

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

        <form action="/admin/emails/log" className="flex items-center gap-2">
          {filters.status !== "failed" ? (
            <input type="hidden" name="status" value={filters.status} />
          ) : null}
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Email, order or error…"
            aria-label="Search the email log"
            className="w-60"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={
              filters.status === "failed" && !filters.q
                ? "No failed emails"
                : "Nothing matches"
            }
            description={
              filters.status === "failed" && !filters.q
                ? "Every email handed to the provider so far was accepted."
                : "Try another status or clear the search."
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
                <Th>Error</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ send, templateName, orderNumber }) => (
                <tr key={send.id} className="align-top hover:bg-ink-50">
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
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={TONES[send.status]}>{send.status}</Badge>
                  </Td>
                  <Td className="max-w-md">
                    {send.error ? (
                      <p
                        className={cn(
                          "break-words text-xs",
                          send.status === "failed" ? "text-red-600" : "text-ink-500",
                        )}
                      >
                        {send.error}
                      </p>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {send.status === "failed" || send.status === "skipped" ? (
                      <RetrySendButton sendId={send.id} />
                    ) : null}
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
