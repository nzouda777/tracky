import { NextResponse, type NextRequest } from "next/server";

import { safeEqual } from "@/lib/crypto/secrets";
import { env } from "@/lib/env";
import { runAutoAdvance } from "@/lib/orders/auto-advance";
import { verifyQstashSignature } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs auto-advance for every store that has it switched on. The work lives in
 * `lib/orders/auto-advance.ts`; this file is only about who may trigger it.
 *
 * Same two schedulers as the email sweep:
 *
 *   GET  — Vercel Cron with `CRON_SECRET` (once a day on the Hobby plan).
 *   POST — the QStash schedule from `npm run qstash:setup`, every hour,
 *          authenticated by its signature or the `CRON_SECRET` bearer token.
 *
 * Each order is claimed before it moves, so overlapping runs are harmless.
 */
export async function GET(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const result = await runAutoAdvance();
  return NextResponse.json({ ok: true, via: "cron-secret", ...result });
}

export async function POST(request: NextRequest) {
  // The QStash signature covers the body, so read the exact bytes first.
  const rawBody = await request.text();

  if (hasCronSecret(request)) {
    const result = await runAutoAdvance();
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

  const result = await runAutoAdvance();
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
