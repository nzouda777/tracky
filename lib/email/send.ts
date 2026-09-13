import { eq } from "drizzle-orm";

import {
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
import { buildTrackingLink } from "@/lib/tracking/links";
import { buildMergeContext } from "./merge";
import { renderEmail } from "./render";

export type DispatchResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Renders and sends one `email_sends` row through Resend, then records the
 * outcome. Safe to call twice: a row that is no longer `scheduled` is skipped,
 * which is what makes the QStash job and the cron sweep able to overlap.
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
    const context = await loadSendContext(send);
    if ("skip" in context) {
      await markSkipped(send.id, context.skip);
      return { status: "skipped", reason: context.skip };
    }

    const { order, store, branding, template, stage } = context;

    const rendered = await renderEmail({
      subject: template.subject,
      body: template.body,
      previewText: template.previewText,
      branding,
      store,
      context: buildMergeContext({
        order,
        store,
        stage,
        trackingLink: buildTrackingLink(store, order),
      }),
    });

    if (!env.resend.configured) {
      const reason = "Email provider is not configured (RESEND_API_KEY).";
      await markFailed(send.id, reason);
      return { status: "failed", error: reason };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(env.resend.apiKey);

    const response = await resend.emails.send({
      // Shared platform sending domain for v1; the store name carries the brand.
      from: `${store.name ?? env.resend.fromName} <${env.resend.fromEmail}>`,
      to: [send.toEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: { "X-Entity-Ref-ID": send.id },
    });

    if (response.error) {
      await markFailed(send.id, response.error.message);
      return { status: "failed", error: response.error.message };
    }

    await db
      .update(emailSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        subject: rendered.subject,
        providerMessageId: response.data?.id ?? null,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, send.id));

    return { status: "sent", providerMessageId: response.data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(send.id, message);
    return { status: "failed", error: message };
  }
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
