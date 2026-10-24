import { after, NextResponse, type NextRequest } from "next/server";

import {
  applyPostalEvent,
  parsePostalEvent,
  tokenMatches,
  verifyPostalSignature,
} from "@/lib/email/postal-webhook";
import { rerouteToResend } from "@/lib/email/send";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Postal's delivery webhook: delivered, delayed (soft fail), held, failed
 * (hard fail) or bounced, for each email Postal accepted.
 *
 * Contract with Postal:
 *   1. The URL carries `?token=POSTAL_WEBHOOK_SECRET`; with
 *      `POSTAL_WEBHOOK_PUBLIC_KEY` set, Postal's RSA signature is checked too.
 *      Anything else is rejected before a byte is written.
 *   2. The report is recorded on the matching send, conditionally, so a
 *      redelivery or an out-of-order report changes nothing.
 *   3. A hard fail or a hold hands the email to Resend, after the response,
 *      so Postal never times out waiting for it.
 */
export async function POST(request: NextRequest) {
  const secret = env.postal.webhookSecret;
  if (!secret) {
    return NextResponse.json(
      { error: "POSTAL_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!tokenMatches(request.nextUrl.searchParams.get("token"), secret)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // The raw bytes, exactly as received: re-serialising would break the signature.
  const rawBody = await request.text();

  const publicKey = env.postal.webhookPublicKey;
  if (
    publicKey &&
    !verifyPostalSignature({
      rawBody,
      signature256: request.headers.get("x-postal-signature-256"),
      signature: request.headers.get("x-postal-signature"),
      publicKey,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const event = parsePostalEvent(body);
  // Events this app does not track are acknowledged, so Postal stops retrying.
  if (!event) return NextResponse.json({ ignored: true });

  const { matched, reroute } = await applyPostalEvent(event);

  if (reroute.length > 0) {
    after(async () => {
      for (const id of reroute) {
        const result = await rerouteToResend(id).catch((error: unknown) => ({
          status: "failed" as const,
          error: error instanceof Error ? error.message : String(error),
        }));
        console.warn(`[email] send ${id} rerouted to Resend after Postal ${event.status}: ${result.status}`);
      }
    });
  }

  return NextResponse.json({ status: event.status, matched, rerouted: reroute.length });
}
