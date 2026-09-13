import { and, asc, eq, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db, emailSends } from "@/lib/db";
import { dispatchEmailSend } from "@/lib/email/send";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Upper bound per run, so one sweep always finishes inside the time limit. */
const BATCH_SIZE = 50;

/**
 * Fallback sweep for scheduled emails that are due but were never delivered by
 * QStash — a queue outage, a missed publish, or a send that failed to enqueue.
 *
 * It is a safety net, not the primary path: QStash handles exact timing, and
 * `dispatchEmailSend` skips rows that are no longer `scheduled`, so the two can
 * run at the same time without double-sending.
 *
 * Wire it up in vercel.json as a cron on `/api/cron/sweep-emails`.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

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
    .limit(BATCH_SIZE);

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const row of due) {
    const result = await dispatchEmailSend(row.id);
    if (result.status === "sent") results.sent += 1;
    else if (result.status === "skipped") results.skipped += 1;
    else results.failed += 1;
  }

  return NextResponse.json({ ok: true, examined: due.length, ...results });
}

function isAuthorised(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    return token.length > 0 && safeEqual(token, env.cronSecret);
  } catch {
    // CRON_SECRET is not configured: refuse rather than run unauthenticated.
    return false;
  }
}
