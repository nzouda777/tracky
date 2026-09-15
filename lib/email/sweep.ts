import { and, asc, eq, lte } from "drizzle-orm";

import { db, emailSends } from "@/lib/db";
import { dispatchEmailSend } from "./send";

/** Upper bound per run, so one sweep always finishes inside the time limit. */
export const SWEEP_BATCH_SIZE = 50;

export type SweepResult = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Sends scheduled emails that are past due but were never delivered by QStash
 * — a queue outage, a missed publish, or a send that failed to enqueue.
 *
 * This is the safety net, not the primary path. QStash handles exact timing,
 * and `dispatchEmailSend` skips rows that are no longer `scheduled`, so a
 * sweep overlapping a QStash delivery cannot send the same email twice.
 *
 * It moves email and nothing else: an order's stage is never touched here,
 * because time passing is not a delivery event.
 */
export async function sweepDueEmails(): Promise<SweepResult> {
  const due = await db
    .select({ id: emailSends.id })
    .from(emailSends)
    .where(
      and(
        eq(emailSends.status, "scheduled"),
        lte(emailSends.scheduledFor, new Date()),
      ),
    )
    .orderBy(asc(emailSends.scheduledFor))
    .limit(SWEEP_BATCH_SIZE);

  const result: SweepResult = {
    examined: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of due) {
    const outcome = await dispatchEmailSend(row.id);
    if (outcome.status === "sent") result.sent += 1;
    else if (outcome.status === "skipped") result.skipped += 1;
    else result.failed += 1;
  }

  return result;
}
