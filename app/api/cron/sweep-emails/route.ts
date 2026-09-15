import { NextResponse, type NextRequest } from "next/server";

import { safeEqual } from "@/lib/crypto/secrets";
import { sweepDueEmails } from "@/lib/email/sweep";
import { env } from "@/lib/env";
import { verifyQstashSignature } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fallback sweep for scheduled emails that are due but were never delivered
 * by QStash. The work itself lives in `lib/email/sweep.ts`; this file is only
 * about who is allowed to ask for it.
 *
 * Two schedulers call it, because one of them cannot call it often enough:
 *
 *   GET  — Vercel Cron, authenticated with `CRON_SECRET`. On the Hobby plan
 *          Vercel permits a single daily run, so `vercel.json` asks for one.
 *   POST — an Upstash QStash schedule, authenticated by its signature, every
 *          15 minutes. This is the one that actually keeps the net tight.
 *
 * The sweep is idempotent, so both firing at once is harmless.
 *
 * POST also accepts the `CRON_SECRET` bearer token, so any other scheduler
 * (GitHub Actions, cron-job.org, a Pro-plan Vercel cron) can drive it without
 * a code change.
 */
export async function GET(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const result = await sweepDueEmails();
  return NextResponse.json({ ok: true, via: "cron-secret", ...result });
}

export async function POST(request: NextRequest) {
  // Read the body first: the QStash signature covers it, so it has to be the
  // exact bytes that arrived.
  const rawBody = await request.text();

  if (hasCronSecret(request)) {
    const result = await sweepDueEmails();
    return NextResponse.json({ ok: true, via: "cron-secret", ...result });
  }

  const verified = await verifyQstashSignature({
    body: rawBody,
    signature: request.headers.get("upstash-signature"),
  });

  if (verified === "unconfigured") {
    return NextResponse.json(
      { error: "QStash signing keys are not configured." },
      { status: 503 },
    );
  }

  if (!verified) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const result = await sweepDueEmails();
  return NextResponse.json({ ok: true, via: "qstash", ...result });
}

function hasCronSecret(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    return token.length > 0 && safeEqual(token, env.cronSecret);
  } catch {
    // CRON_SECRET is not configured: refuse rather than run unauthenticated.
    return false;
  }
}
