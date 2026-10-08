import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { emailSends, emailTemplates, orders, type EmailSend } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

/** Which rows the log shows. Failures first: they are why the page exists. */
export const EMAIL_LOG_STATUSES = ["failed", "skipped", "sent", "scheduled", "all"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export type EmailLogSearchParams = {
  status?: string;
  q?: string;
  page?: string;
};

export type EmailLogFilters = {
  status: EmailLogStatus;
  q: string;
  page: number;
};

export const EMAIL_LOG_PER_PAGE = 50;

export function parseEmailLogFilters(params: EmailLogSearchParams): EmailLogFilters {
  const status = EMAIL_LOG_STATUSES.includes(params.status as EmailLogStatus)
    ? (params.status as EmailLogStatus)
    : "failed";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return { status, q: (params.q ?? "").trim(), page };
}

export type EmailLogRow = {
  send: EmailSend;
  templateName: string | null;
  orderNumber: string | null;
};

/** Every email send for this store matching the filters, most recent first. */
export async function listEmailLog(tdb: TenantDb, filters: EmailLogFilters) {
  const conditions: SQL[] = [];
  if (filters.status !== "all") conditions.push(eq(emailSends.status, filters.status));
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(emailSends.toEmail, pattern),
        ilike(emailSends.error, pattern),
        ilike(orders.orderNumber, pattern),
      ) as SQL,
    );
  }
  const where = tdb.scope(emailSends, and(...conditions));

  const [{ value: total }] = await tdb.raw
    .select({ value: count() })
    .from(emailSends)
    .leftJoin(orders, eq(orders.id, emailSends.orderId))
    .where(where);

  const rows: EmailLogRow[] = await tdb.raw
    .select({
      send: emailSends,
      templateName: emailTemplates.name,
      orderNumber: orders.orderNumber,
    })
    .from(emailSends)
    .leftJoin(emailTemplates, eq(emailTemplates.id, emailSends.templateId))
    .leftJoin(orders, eq(orders.id, emailSends.orderId))
    .where(where)
    .orderBy(desc(emailSends.updatedAt))
    .limit(EMAIL_LOG_PER_PAGE)
    .offset((filters.page - 1) * EMAIL_LOG_PER_PAGE);

  return { rows, total, page: filters.page, perPage: EMAIL_LOG_PER_PAGE };
}

/** Row count per status, for the filter tabs and the sidebar badge. */
export async function countEmailSendsByStatus(
  tdb: TenantDb,
): Promise<Record<EmailSend["status"], number>> {
  const rows = await tdb.raw
    .select({ status: emailSends.status, value: count() })
    .from(emailSends)
    .where(tdb.scope(emailSends))
    .groupBy(emailSends.status);

  const counts = { scheduled: 0, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) counts[row.status] = row.value;
  return counts;
}
