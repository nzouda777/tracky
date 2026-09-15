import { NextResponse, type NextRequest } from "next/server";

import { dispatchEmailSend } from "@/lib/email/send";
import { verifyQstashSignature } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QStash callback: sends one scheduled email when its delay elapses.
 *
 * The Upstash signature is verified so nothing but QStash can trigger a send.
 * `dispatchEmailSend` is itself idempotent, so a QStash retry or an overlap
 * with the cron sweep cannot send the same email twice.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

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
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let emailSendId: string | undefined;
  try {
    emailSendId = (JSON.parse(rawBody) as { emailSendId?: string }).emailSendId;
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  if (!emailSendId) {
    return NextResponse.json({ error: "Missing emailSendId." }, { status: 400 });
  }

  const result = await dispatchEmailSend(emailSendId);

  // A failure is reported as 500 so QStash retries with backoff; the send row
  // already records the error either way.
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
