import { eq } from "drizzle-orm";

import {
  autoAdvanceSettings,
  brandingSettings,
  db,
  emailSends,
  emailTemplates,
  orders,
  stages,
  stores,
  type EmailSend,
} from "@/lib/db";
import { env } from "@/lib/env";
import { mayEmailOrder } from "@/lib/stores/tracking-window";
import { buildTrackingLink } from "@/lib/tracking/links";
import { buildMergeContext } from "./merge";
import { buildOrderFacts } from "./order-facts";
import { providerChain, sendEmail, type SendEmailInput } from "./providers";
import { renderEmail } from "./render";

export type DispatchResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Renders and sends one `email_sends` row through the provider chain (the
 * store's main provider, then the other), then records the outcome and which provider took it. Safe to
 * call twice: a row that is no longer `scheduled` is skipped, which is what
 * makes the QStash job and the cron sweep able to overlap.
 */
export async function dispatchEmailSend(
  emailSendId: string,
): Promise<DispatchResult> {
  const [send] = await db
    .select()
    .from(emailSends)
    .where(eq(emailSends.id, emailSendId))
    .limit(1);

  if (!send) return { status: "skipped", reason: "Send record not found." };
  if (send.status !== "scheduled") {
    return { status: "skipped", reason: `Already ${send.status}.` };
  }

  try {
    const prepared = await prepareSend(send);
    if ("skip" in prepared) {
      await markSkipped(send.id, prepared.skip);
      return { status: "skipped", reason: prepared.skip };
    }

    const chain = providerChain(prepared.store.emailPrimaryProvider, send.toEmail);
    if (chain.length === 0) {
      const reason =
        "Email provider is not configured (RESEND_API_KEY or POSTAL_API_KEY).";
      await markFailed(send.id, reason);
      return { status: "failed", error: reason };
    }

    // Throws on refusal; the catch below records it as failed.
    const result = await sendEmail(prepared.input, chain);

    await db
      .update(emailSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        subject: prepared.input.subject,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        // A retried send starts a new delivery: drop the previous report.
        deliveryStatus: null,
        deliveryDetail: null,
        deliveryUpdatedAt: null,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, send.id));

    return { status: "sent", providerMessageId: result.providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(send.id, message);
    return { status: "failed", error: message };
  }
}

/**
 * Sends again through Resend an email Postal accepted but then could not
 * deliver (hard fail, or held), as reported by Postal's webhook.
 *
 * The caller has already claimed the row (its `delivery_status` moved to
 * `failed`/`held`), which is what keeps a redelivered webhook from sending
 * twice. A store paused, a cancelled order or a deactivated template since
 * the first send means the email is not sent again — the row says why.
 */
export async function rerouteToResend(emailSendId: string): Promise<DispatchResult> {
  const [send] = await db
    .select()
    .from(emailSends)
    .where(eq(emailSends.id, emailSendId))
    .limit(1);
  if (!send) return { status: "skipped", reason: "Send record not found." };

  const postalReport = send.deliveryDetail ?? "no detail";
  const note = async (detail: string) => {
    await db
      .update(emailSends)
      .set({ deliveryDetail: detail.slice(0, 1000), updatedAt: new Date() })
      .where(eq(emailSends.id, send.id));
  };

  const chain = providerChain("resend").filter((p) => p.name === "resend");
  if (chain.length === 0) {
    const reason = "Resend is not configured, so it could not take over.";
    await note(`${postalReport} — ${reason}`);
    return { status: "skipped", reason };
  }

  try {
    const prepared = await prepareSend(send);
    if ("skip" in prepared) {
      await note(`${postalReport} — not resent: ${prepared.skip}`);
      return { status: "skipped", reason: prepared.skip };
    }

    // A key of its own: Resend has never seen this send, but a retried
    // reroute must still not deliver it twice.
    const result = await sendEmail(
      { ...prepared.input, idempotencyKey: `${send.id}:reroute` },
      chain,
    );

    await db
      .update(emailSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        // Resend sends no delivery reports here, so the outcome is unknown
        // again; the detail keeps what Postal said.
        deliveryStatus: null,
        deliveryDetail: `Postal could not deliver (${postalReport}); resent via Resend.`.slice(0, 1000),
        deliveryUpdatedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, send.id));

    return { status: "sent", providerMessageId: result.providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(
      send.id,
      `Postal could not deliver (${postalReport}); Resend fallback failed: ${message}`,
    );
    return { status: "failed", error: message };
  }
}

/** Loads, checks and renders one send: everything but choosing a provider. */
async function prepareSend(
  send: EmailSend,
): Promise<{ skip: string } | { store: typeof stores.$inferSelect; input: SendEmailInput }> {
  const context = await loadSendContext(send);
  if ("skip" in context) return context;

  const { order, store, branding, template, stage } = context;

  const rendered = await renderEmail({
    subject: template.subject,
    body: template.body,
    previewText: template.previewText,
    design: template.design,
    designOptions: template.designOptions,
    order: buildOrderFacts(order),
    branding,
    store,
    context: buildMergeContext({
      order,
      store,
      stage,
      trackingLink: buildTrackingLink(store, order),
    }),
  });

  return {
    store,
    input: {
      // Shared platform sending domain for v1; the store name carries the brand.
      from: `${store.name ?? env.resend.fromName} <${env.resend.fromEmail}>`,
      // Every template invites the customer to reply, so replies have to reach
      // a mailbox. The sending domain is often a no-MX subdomain chosen for
      // deliverability, where a reply would simply bounce.
      ...(env.resend.replyTo ? { replyTo: env.resend.replyTo } : {}),
      to: send.toEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: { "X-Entity-Ref-ID": send.id },
      idempotencyKey: send.id,
    },
  };
}

type SendContext =
  | { skip: string }
  | {
      order: typeof orders.$inferSelect;
      store: typeof stores.$inferSelect;
      branding: typeof brandingSettings.$inferSelect | null;
      template: typeof emailTemplates.$inferSelect;
      stage: typeof stages.$inferSelect | null;
    };

async function loadSendContext(send: EmailSend): Promise<SendContext> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, send.orderId))
    .limit(1);
  if (!order) return { skip: "Order no longer exists." };
  if (order.cancelledAt) return { skip: "Order was cancelled." };

  // Defence in depth: the send row and the order must belong to the same store.
  if (order.storeId !== send.storeId) {
    return { skip: "Send record does not match the order's store." };
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, send.storeId))
    .limit(1);
  if (!store) return { skip: "Store no longer exists." };
  if (store.status !== "active") return { skip: "Store is uninstalled." };
  // Paused by its owner. Recorded as a skip rather than a failure: nothing
  // went wrong, and the row stays in the store's history as evidence of what
  // the customer was not told while the pause was on.
  if (store.pausedAt) return { skip: "Store is paused." };
  const [progression] = await db
    .select()
    .from(autoAdvanceSettings)
    .where(eq(autoAdvanceSettings.storeId, send.storeId))
    .limit(1);
  if (!mayEmailOrder(store, progression ?? null, order.orderDate)) {
    return { skip: "Order was placed before the store's email start date." };
  }

  if (!send.templateId) return { skip: "Send record has no template." };
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, send.templateId))
    .limit(1);
  if (!template) return { skip: "Template was deleted." };
  if (!template.isActive) return { skip: "Template is inactive." };

  const [branding] = await db
    .select()
    .from(brandingSettings)
    .where(eq(brandingSettings.storeId, send.storeId))
    .limit(1);

  const stage = order.currentStageId
    ? ((
        await db
          .select()
          .from(stages)
          .where(eq(stages.id, order.currentStageId))
          .limit(1)
      )[0] ?? null)
    : null;

  return { order, store, branding: branding ?? null, template, stage };
}

async function markSkipped(id: string, reason: string): Promise<void> {
  await db
    .update(emailSends)
    .set({ status: "skipped", error: reason, updatedAt: new Date() })
    .where(eq(emailSends.id, id));
}

async function markFailed(id: string, error: string): Promise<void> {
  console.error(`[email] send ${id} failed: ${error}`);
  await db
    .update(emailSends)
    .set({ status: "failed", error: error.slice(0, 1000), updatedAt: new Date() })
    .where(eq(emailSends.id, id));
}
