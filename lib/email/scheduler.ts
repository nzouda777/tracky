import { and, asc, eq } from "drizzle-orm";

import {
  emailSends,
  emailSequenceSteps,
  type EmailSequenceStep,
  type Order,
  type Stage,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Email scheduling.
 *
 * This is the ONLY place in the application where a delay in days has any
 * effect, and its effect is limited to when an email leaves. Nothing here
 * touches `orders.current_stage_id` or writes `order_stage_history`: a delay
 * can never advance a delivery.
 *
 * Each `email_sends` row is unique per (order, sequence step), so replaying a
 * webhook or repeating a transition never double-schedules a step.
 */

async function activeSteps(tdb: TenantDb): Promise<EmailSequenceStep[]> {
  return tdb.findMany(emailSequenceSteps, {
    where: eq(emailSequenceSteps.isActive, true),
    orderBy: asc(emailSequenceSteps.position),
  });
}

/**
 * Creates the `email_sends` row and hands it to QStash (or sends it straight
 * away when it is already due). Returns false when the step was already
 * scheduled for this order.
 */
async function scheduleStep({
  tdb,
  order,
  step,
  scheduledFor,
}: {
  tdb: TenantDb;
  order: Order;
  step: EmailSequenceStep;
  scheduledFor: Date;
}): Promise<boolean> {
  if (!order.customerEmail) return false;

  // Rely on the (order_id, sequence_step_id) unique index for idempotence
  // rather than a read-then-write race.
  const inserted = await tdb.raw
    .insert(emailSends)
    .values({
      storeId: tdb.storeId,
      orderId: order.id,
      sequenceStepId: step.id,
      templateId: step.templateId,
      toEmail: order.customerEmail,
      status: "scheduled",
      scheduledFor,
    })
    .onConflictDoNothing({
      target: [emailSends.orderId, emailSends.sequenceStepId],
    })
    .returning({ id: emailSends.id });

  const row = inserted[0];
  if (!row) return false;

  await enqueueSend({ emailSendId: row.id, scheduledFor });
  return true;
}

/**
 * Hands a scheduled send to QStash. When the send is already due it is
 * dispatched inline instead, so the customer is not waiting on a queue for an
 * email that should go out now.
 *
 * If QStash is unavailable the row simply stays `scheduled`; the Vercel Cron
 * sweep in /api/cron/sweep-emails will pick it up.
 */
async function enqueueSend({
  emailSendId,
  scheduledFor,
}: {
  emailSendId: string;
  scheduledFor: Date;
}): Promise<void> {
  const delaySeconds = Math.max(
    0,
    Math.round((scheduledFor.getTime() - Date.now()) / 1000),
  );

  if (delaySeconds === 0) {
    const { dispatchEmailSend } = await import("./send");
    await dispatchEmailSend(emailSendId).catch((error) => {
      console.error("[email] immediate dispatch failed", error);
    });
    return;
  }

  if (!env.qstash.configured) {
    console.warn(
      "[email] QSTASH_TOKEN is not set; relying on the cron sweep for send " +
        emailSendId,
    );
    return;
  }

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: env.qstash.token });
    const result = await client.publishJSON({
      url: `${env.appUrl}/api/jobs/send-email`,
      body: { emailSendId },
      delay: delaySeconds,
      retries: 3,
      // Lets QStash collapse duplicates if the same row is enqueued twice.
      deduplicationId: `email-send-${emailSendId}`,
    });

    await recordQstashMessageId(emailSendId, result.messageId);
  } catch (error) {
    console.error("[email] failed to enqueue with QStash", error);
  }
}

async function recordQstashMessageId(
  emailSendId: string,
  messageId: string,
): Promise<void> {
  const { db } = await import("@/lib/db");
  await db
    .update(emailSends)
    .set({ qstashMessageId: messageId, updatedAt: new Date() })
    .where(eq(emailSends.id, emailSendId));
}

/**
 * Schedules the delay-based part of the sequence for a newly imported order.
 *
 * `delay_after_order` counts from the real Shopify order date.
 * `delay_after_previous` counts from the previously scheduled delay step, so a
 * chain of "3 days later, then 4 days later" behaves as an author expects.
 */
export async function scheduleOrderSequence({
  tdb,
  order,
}: {
  tdb: TenantDb;
  order: Order;
}): Promise<number> {
  if (!order.customerEmail) return 0;

  const steps = await activeSteps(tdb);
  let cursor = order.orderDate.getTime();
  let scheduled = 0;

  for (const step of steps) {
    if (step.triggerType === "on_stage") continue;

    const days = step.delayDays ?? 0;
    const base =
      step.triggerType === "delay_after_order" ? order.orderDate.getTime() : cursor;
    const when = new Date(base + days * DAY_MS);
    cursor = when.getTime();

    if (await scheduleStep({ tdb, order, step, scheduledFor: when })) {
      scheduled += 1;
    }
  }

  return scheduled;
}

/**
 * Schedules every `on_stage` step attached to the stage an order just reached.
 * Called from `recordStageTransition`, i.e. only ever off a real event.
 */
export async function scheduleStageEmails({
  tdb,
  order,
  stage,
}: {
  tdb: TenantDb;
  order: Order;
  stage: Stage;
}): Promise<number> {
  if (!order.customerEmail) return 0;

  const steps = await tdb.findMany(emailSequenceSteps, {
    where: and(
      eq(emailSequenceSteps.isActive, true),
      eq(emailSequenceSteps.triggerType, "on_stage"),
      eq(emailSequenceSteps.stageId, stage.id),
    ),
    orderBy: asc(emailSequenceSteps.position),
  });

  let scheduled = 0;
  for (const step of steps) {
    // Stage emails are sent as soon as the stage is reached.
    if (await scheduleStep({ tdb, order, step, scheduledFor: new Date() })) {
      scheduled += 1;
    }
  }
  return scheduled;
}

/**
 * Cancels still-pending scheduled sends for an order — used when an order is
 * cancelled in Shopify, so a customer does not get a "your order is on the
 * way" email for something that no longer exists.
 */
export async function cancelPendingSends({
  tdb,
  orderId,
  reason,
}: {
  tdb: TenantDb;
  orderId: string;
  reason: string;
}): Promise<number> {
  const cancelled = await tdb.update(
    emailSends,
    { status: "skipped", error: reason, updatedAt: new Date() },
    and(eq(emailSends.orderId, orderId), eq(emailSends.status, "scheduled")),
  );
  return cancelled.length;
}
