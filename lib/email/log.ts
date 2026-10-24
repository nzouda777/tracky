import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  emailSends,
  emailSequenceSteps,
  emailTemplates,
  orders,
  stages,
  type EmailSend,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

/** Which rows the log shows. Failures first: they are why the page exists. */
export const EMAIL_LOG_STATUSES = ["failed", "skipped", "sent", "scheduled", "all"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

/** Providers the log can filter on. Older rows may carry a retired name. */
export const EMAIL_LOG_PROVIDERS = ["all", "resend", "postal"] as const;
export type EmailLogProvider = (typeof EMAIL_LOG_PROVIDERS)[number];

export type EmailLogSearchParams = {
  status?: string;
  provider?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
  view?: string;
};

export type EmailLogFilters = {
  status: EmailLogStatus;
  provider: EmailLogProvider;
  /** `YYYY-MM-DD`, inclusive, or empty. */
  from: string;
  /** `YYYY-MM-DD`, inclusive, or empty. */
  to: string;
  q: string;
  page: number;
  /** The send whose detail panel is open. */
  view: string;
};

export const EMAIL_LOG_PER_PAGE = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A `YYYY-MM-DD` that is a real date, or "" — never something Postgres rejects. */
function parseDay(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? "" : value;
}

export function parseEmailLogFilters(params: EmailLogSearchParams): EmailLogFilters {
  const status = EMAIL_LOG_STATUSES.includes(params.status as EmailLogStatus)
    ? (params.status as EmailLogStatus)
    : "failed";
  const provider = EMAIL_LOG_PROVIDERS.includes(params.provider as EmailLogProvider)
    ? (params.provider as EmailLogProvider)
    : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return {
    status,
    provider,
    from: parseDay(params.from),
    to: parseDay(params.to),
    q: (params.q ?? "").trim(),
    page,
    view: UUID.test(params.view ?? "") ? (params.view as string) : "",
  };
}

export type EmailLogRow = {
  send: EmailSend;
  templateName: string | null;
  orderNumber: string | null;
  stageName: string | null;
};

/** When a send happened, or is due: what the date filter applies to. */
const sendDate = sql`coalesce(${emailSends.sentAt}, ${emailSends.scheduledFor})`;

/** Every email send for this store matching the filters, most recent first. */
export async function listEmailLog(tdb: TenantDb, filters: EmailLogFilters) {
  const conditions: SQL[] = [];
  if (filters.status !== "all") conditions.push(eq(emailSends.status, filters.status));
  if (filters.provider !== "all") conditions.push(eq(emailSends.provider, filters.provider));
  if (filters.from) {
    conditions.push(sql`${sendDate} >= ${`${filters.from}T00:00:00Z`}::timestamptz`);
  }
  if (filters.to) {
    // Inclusive: everything before the start of the following day.
    const end = new Date(Date.parse(`${filters.to}T00:00:00Z`) + DAY_MS).toISOString();
    conditions.push(sql`${sendDate} < ${end}::timestamptz`);
  }
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(emailSends.toEmail, pattern),
        ilike(emailSends.error, pattern),
        ilike(emailSends.deliveryDetail, pattern),
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
      stageName: stages.name,
    })
    .from(emailSends)
    .leftJoin(emailTemplates, eq(emailTemplates.id, emailSends.templateId))
    .leftJoin(orders, eq(orders.id, emailSends.orderId))
    .leftJoin(emailSequenceSteps, eq(emailSequenceSteps.id, emailSends.sequenceStepId))
    .leftJoin(stages, eq(stages.id, emailSequenceSteps.stageId))
    .where(where)
    .orderBy(desc(emailSends.updatedAt))
    .limit(EMAIL_LOG_PER_PAGE)
    .offset((filters.page - 1) * EMAIL_LOG_PER_PAGE);

  return { rows, total, page: filters.page, perPage: EMAIL_LOG_PER_PAGE };
}

export type EmailLogDetail = EmailLogRow & {
  triggerType: string | null;
  delayDays: number | null;
};

/** One send of this store with everything the detail panel shows. */
export async function getEmailSendDetail(
  tdb: TenantDb,
  sendId: string,
): Promise<EmailLogDetail | null> {
  const [row] = await tdb.raw
    .select({
      send: emailSends,
      templateName: emailTemplates.name,
      orderNumber: orders.orderNumber,
      stageName: stages.name,
      triggerType: emailSequenceSteps.triggerType,
      delayDays: emailSequenceSteps.delayDays,
    })
    .from(emailSends)
    .leftJoin(emailTemplates, eq(emailTemplates.id, emailSends.templateId))
    .leftJoin(orders, eq(orders.id, emailSends.orderId))
    .leftJoin(emailSequenceSteps, eq(emailSequenceSteps.id, emailSends.sequenceStepId))
    .leftJoin(stages, eq(stages.id, emailSequenceSteps.stageId))
    .where(tdb.scope(emailSends, eq(emailSends.id, sendId)))
    .limit(1);
  return row ?? null;
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

export type ProviderSplit = { provider: string; count: number; share: number };

export type EmailVolumeStats = {
  sentLast7Days: number;
  sentLast30Days: number;
  /** Who carried the last 30 days of sent mail, largest share first. */
  providers30Days: ProviderSplit[];
};

/**
 * Sent volume and the provider split over the last 30 days.
 *
 * The split is the signal to watch: a growing Postal share means Resend is
 * hitting its limits.
 */
export async function getEmailVolumeStats(
  tdb: TenantDb,
  now: Date = new Date(),
): Promise<EmailVolumeStats> {
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  const rows = await tdb.raw
    .select({
      provider: emailSends.provider,
      last30: count(),
      last7: sql<number>`count(*) filter (where ${emailSends.sentAt} >= ${since7.toISOString()}::timestamptz)`.mapWith(
        Number,
      ),
    })
    .from(emailSends)
    .where(
      tdb.scope(
        emailSends,
        eq(emailSends.status, "sent"),
        gte(emailSends.sentAt, since30),
      ),
    )
    .groupBy(emailSends.provider);

  return summariseVolume(rows);
}

/** Pure half of `getEmailVolumeStats`, kept apart so it can be tested. */
export function summariseVolume(
  rows: Array<{ provider: string | null; last30: number; last7: number }>,
): EmailVolumeStats {
  const sentLast30Days = rows.reduce((sum, row) => sum + row.last30, 0);
  const sentLast7Days = rows.reduce((sum, row) => sum + row.last7, 0);
  const providers30Days = rows
    .map((row) => ({
      provider: row.provider ?? "unknown",
      count: row.last30,
      share: sentLast30Days === 0 ? 0 : row.last30 / sentLast30Days,
    }))
    .sort((a, b) => b.count - a.count);
  return { sentLast7Days, sentLast30Days, providers30Days };
}
