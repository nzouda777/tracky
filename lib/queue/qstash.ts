import { env, isConfigured, optional } from "@/lib/env";

/**
 * QStash as the project's scheduler of record.
 *
 * Vercel's Hobby plan runs a cron job **at most once a day**, which is far too
 * coarse for the email safety net. So the work is split:
 *
 *   - Vercel Cron keeps the once-a-day run it is allowed. It needs no setup
 *     beyond `vercel.json` and it keeps working even if QStash is removed.
 *   - A QStash schedule runs the same endpoint every 15 minutes.
 *
 * Both call `/api/cron/sweep-emails`, which is idempotent, so running them at
 * the same moment is harmless. Upgrading Vercel to Pro later is a one-line
 * change to `vercel.json` and does not require unpicking any of this.
 */

/**
 * Stable id for the sweep schedule.
 *
 * QStash treats `scheduleId` on create as an upsert, so re-running the setup
 * script updates the existing schedule instead of stacking up duplicates that
 * would each call the endpoint.
 */
export const SWEEP_SCHEDULE_ID = "tracky-sweep-emails";

/** What Vercel Cron is limited to on Hobby; also the floor everywhere else. */
export const VERCEL_DAILY_CRON = "0 3 * * *";

/** The frequent sweep, which only QStash can run on a Hobby account. */
export const DEFAULT_SWEEP_CRON = "*/15 * * * *";

/** Overridable so an operator can slow the sweep down without a deploy. */
export function sweepCron(): string {
  return optional("QSTASH_SWEEP_CRON", DEFAULT_SWEEP_CRON);
}

export function sweepDestination(): string {
  return `${env.appUrl}/api/cron/sweep-emails`;
}

export function qstashConfigured(): boolean {
  return isConfigured("QSTASH_TOKEN");
}

export function qstashSigningKeysConfigured(): boolean {
  return isConfigured("QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY");
}

export async function qstashClient() {
  const { Client } = await import("@upstash/qstash");
  return new Client({ token: env.qstash.token });
}

/** How long a health check may block a page render. */
const STATUS_TIMEOUT_MS = 3000;

/**
 * Verifies that a request really came from QStash.
 *
 * Returns `"unconfigured"` rather than `false` when the signing keys are
 * missing, so a caller can answer 503 (fix your configuration) instead of 401
 * (you are not allowed), which is a much faster thing to debug.
 */
export async function verifyQstashSignature({
  body,
  signature,
}: {
  body: string;
  signature: string | null;
}): Promise<true | false | "unconfigured"> {
  if (!qstashSigningKeysConfigured()) return "unconfigured";
  if (!signature) return false;

  const { Receiver } = await import("@upstash/qstash");
  const receiver = new Receiver({
    currentSigningKey: optional("QSTASH_CURRENT_SIGNING_KEY", ""),
    nextSigningKey: optional("QSTASH_NEXT_SIGNING_KEY", ""),
  });

  return receiver.verify({ signature, body }).catch(() => false);
}

export type SweepScheduleStatus =
  | { state: "not-configured" }
  | { state: "missing" }
  | { state: "unreachable"; error: string }
  | { state: "active"; cron: string; destination: string; paused: boolean };

/**
 * Reads the live sweep schedule back from QStash.
 *
 * Used by the platform health page to answer the question the Vercel plan
 * limit actually raises: *is anything sweeping more than once a day?*
 *
 * Every failure is reported rather than thrown, and the whole thing is bounded
 * by a short timeout with the SDK's retries turned off. A health page that
 * hangs because a health check is retrying with exponential backoff is worse
 * than one that says "unreachable" — the caller is a page render, not a job.
 */
export async function getSweepScheduleStatus(): Promise<SweepScheduleStatus> {
  if (!qstashConfigured()) return { state: "not-configured" };

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: env.qstash.token, retry: false });

    const schedule = await withTimeout(
      client.schedules.get(SWEEP_SCHEDULE_ID),
      STATUS_TIMEOUT_MS,
    );

    return {
      state: "active",
      cron: schedule.cron,
      destination: schedule.destination,
      paused: schedule.isPaused,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // QStash answers 404 for an id it does not know, which is the normal
    // "you have not run the setup script yet" case, not an outage.
    if (/404|not ?found/i.test(message)) return { state: "missing" };
    return { state: "unreachable", error: message };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}
