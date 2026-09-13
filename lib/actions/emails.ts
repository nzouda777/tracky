"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import {
  emailSends,
  emailSequenceSteps,
  emailTemplates,
  orders,
  stages,
  type EmailTemplate,
} from "@/lib/db";
import { dispatchEmailSend } from "@/lib/email/send";
import { findUnknownMergeTokens } from "@/lib/email/merge";
import { guard, type ActionResult } from "./result";

function revalidateEmails() {
  revalidatePath("/admin/emails/templates");
  revalidatePath("/admin/emails/sequence");
  revalidatePath("/admin/orders");
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Active templates for this store, used by the manual/bulk send controls. */
export async function listActiveTemplates(): Promise<EmailTemplate[]> {
  const { tdb } = await requireOwner();
  return tdb.findMany(emailTemplates, {
    where: eq(emailTemplates.isActive, true),
    orderBy: asc(emailTemplates.name),
  });
}

function readTemplateForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    previewText: String(formData.get("previewText") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    isActive: formData.get("isActive") === "on",
  };
}

function validateTemplate(values: ReturnType<typeof readTemplateForm>) {
  const fieldErrors: Record<string, string> = {};
  if (!values.name) fieldErrors.name = "Give this template a name.";
  if (!values.subject) fieldErrors.subject = "Enter a subject line.";
  if (!values.body) fieldErrors.body = "The email body cannot be empty.";

  // Unknown merge tokens would reach the customer as literal {{text}}.
  const unknown = [
    ...findUnknownMergeTokens(values.subject),
    ...findUnknownMergeTokens(values.body),
  ];
  if (unknown.length > 0) {
    fieldErrors.body = `Unknown merge variable(s): ${[...new Set(unknown)]
      .map((token) => `{{${token}}}`)
      .join(", ")}`;
  }

  return fieldErrors;
}

export async function createTemplateAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const values = readTemplateForm(formData);

    const fieldErrors = validateTemplate(values);
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

    const created = await tdb.insertOne(emailTemplates, {
      ...values,
      key: null,
    });

    revalidateEmails();
    return { ok: true, message: `Template "${created.name}" created.` };
  });
}

export async function updateTemplateAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const templateId = String(formData.get("templateId") ?? "");
    const values = readTemplateForm(formData);

    const existing = await tdb.findById(emailTemplates, templateId);
    if (!existing) return { error: "That template no longer exists." };

    const fieldErrors = validateTemplate(values);
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

    await tdb.updateById(emailTemplates, templateId, {
      ...values,
      updatedAt: new Date(),
    });

    revalidateEmails();
    return { ok: true, message: "Template saved." };
  });
}

export async function duplicateTemplateAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const templateId = String(formData.get("templateId") ?? "");

    const existing = await tdb.findById(emailTemplates, templateId);
    if (!existing) return { error: "That template no longer exists." };

    const copy = await tdb.insertOne(emailTemplates, {
      key: null,
      name: `${existing.name} (copy)`,
      subject: existing.subject,
      previewText: existing.previewText,
      body: existing.body,
      isActive: false,
    });

    revalidateEmails();
    return { ok: true, message: `Created "${copy.name}".` };
  });
}

export async function deleteTemplateAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const templateId = String(formData.get("templateId") ?? "");

    const existing = await tdb.findById(emailTemplates, templateId);
    if (!existing) return { error: "That template no longer exists." };

    const usedBy = await tdb.findMany(emailSequenceSteps, {
      where: eq(emailSequenceSteps.templateId, templateId),
    });
    if (usedBy.length > 0) {
      return {
        error: `This template is used by ${usedBy.length} sequence step(s). Remove those first, or deactivate the template instead.`,
      };
    }

    await tdb.deleteById(emailTemplates, templateId);
    revalidateEmails();
    return { ok: true, message: `Template "${existing.name}" deleted.` };
  });
}

// ---------------------------------------------------------------------------
// Sequence steps
// ---------------------------------------------------------------------------

export async function createSequenceStepAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();

    const templateId = String(formData.get("templateId") ?? "");
    const triggerType = String(formData.get("triggerType") ?? "");
    const stageId = String(formData.get("stageId") ?? "");
    const delayDaysRaw = String(formData.get("delayDays") ?? "");

    const template = await tdb.findById(emailTemplates, templateId);
    if (!template) return { fieldErrors: { templateId: "Choose a template." } };

    const validation = await validateTrigger(tdb, {
      triggerType,
      stageId,
      delayDaysRaw,
    });
    if ("fieldErrors" in validation) return validation;

    const existing = await tdb.findMany(emailSequenceSteps);

    await tdb.insertOne(emailSequenceSteps, {
      templateId,
      triggerType: validation.triggerType,
      stageId: validation.stageId,
      delayDays: validation.delayDays,
      position: existing.length,
      isActive: true,
    });

    revalidateEmails();
    return { ok: true, message: "Sequence step added." };
  });
}

export async function updateSequenceStepAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const stepId = String(formData.get("stepId") ?? "");

    const step = await tdb.findById(emailSequenceSteps, stepId);
    if (!step) return { error: "That sequence step no longer exists." };

    const templateId = String(formData.get("templateId") ?? step.templateId);
    const template = await tdb.findById(emailTemplates, templateId);
    if (!template) return { fieldErrors: { templateId: "Choose a template." } };

    const validation = await validateTrigger(tdb, {
      triggerType: String(formData.get("triggerType") ?? step.triggerType),
      stageId: String(formData.get("stageId") ?? step.stageId ?? ""),
      delayDaysRaw: String(formData.get("delayDays") ?? step.delayDays ?? ""),
    });
    if ("fieldErrors" in validation) return validation;

    await tdb.updateById(emailSequenceSteps, stepId, {
      templateId,
      triggerType: validation.triggerType,
      stageId: validation.stageId,
      delayDays: validation.delayDays,
      isActive: formData.get("isActive") === "on",
      updatedAt: new Date(),
    });

    revalidateEmails();
    return { ok: true, message: "Sequence step saved." };
  });
}

export async function toggleSequenceStepAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const stepId = String(formData.get("stepId") ?? "");

    const step = await tdb.findById(emailSequenceSteps, stepId);
    if (!step) return { error: "That sequence step no longer exists." };

    await tdb.updateById(emailSequenceSteps, stepId, {
      isActive: !step.isActive,
      updatedAt: new Date(),
    });

    revalidateEmails();
    return {
      ok: true,
      message: step.isActive ? "Step paused." : "Step activated.",
    };
  });
}

export async function deleteSequenceStepAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const stepId = String(formData.get("stepId") ?? "");

    const step = await tdb.findById(emailSequenceSteps, stepId);
    if (!step) return { error: "That sequence step no longer exists." };

    await tdb.deleteById(emailSequenceSteps, stepId);

    // Keep positions contiguous so the editor's order stays stable.
    const remaining = await tdb.findMany(emailSequenceSteps, {
      orderBy: asc(emailSequenceSteps.position),
    });
    await Promise.all(
      remaining.map((row, index) =>
        row.position === index
          ? Promise.resolve(null)
          : tdb.updateById(emailSequenceSteps, row.id, { position: index }),
      ),
    );

    revalidateEmails();
    return { ok: true, message: "Sequence step removed." };
  });
}

export async function reorderSequenceStepsAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const requested = String(formData.get("order") ?? "").split(",").filter(Boolean);

    const existing = await tdb.findMany(emailSequenceSteps, {
      orderBy: asc(emailSequenceSteps.position),
    });
    const known = new Set(existing.map((row) => row.id));
    const ordered = requested.filter((id) => known.has(id));
    for (const row of existing) {
      if (!ordered.includes(row.id)) ordered.push(row.id);
    }

    await Promise.all(
      ordered.map((id, index) =>
        tdb.updateById(emailSequenceSteps, id, {
          position: index,
          updatedAt: new Date(),
        }),
      ),
    );

    revalidateEmails();
    return { ok: true, message: "Sequence order saved." };
  });
}

type TriggerValidation =
  | { fieldErrors: Record<string, string> }
  | {
      triggerType: "on_stage" | "delay_after_order" | "delay_after_previous";
      stageId: string | null;
      delayDays: number | null;
    };

async function validateTrigger(
  tdb: Awaited<ReturnType<typeof requireOwner>>["tdb"],
  input: { triggerType: string; stageId: string; delayDaysRaw: string },
): Promise<TriggerValidation> {
  if (input.triggerType === "on_stage") {
    const stage = input.stageId ? await tdb.findById(stages, input.stageId) : null;
    if (!stage) {
      return { fieldErrors: { stageId: "Choose the stage that sends this email." } };
    }
    return { triggerType: "on_stage", stageId: stage.id, delayDays: null };
  }

  if (
    input.triggerType === "delay_after_order" ||
    input.triggerType === "delay_after_previous"
  ) {
    const days = Number(input.delayDaysRaw);
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return {
        fieldErrors: { delayDays: "Enter a delay between 0 and 365 days." },
      };
    }
    return {
      triggerType: input.triggerType,
      stageId: null,
      delayDays: Math.round(days),
    };
  }

  return { fieldErrors: { triggerType: "Choose a trigger." } };
}

// ---------------------------------------------------------------------------
// Manual and bulk sends (Phase 9)
// ---------------------------------------------------------------------------

/**
 * Queues a template for a set of orders and sends straight away.
 *
 * Manual sends carry `sequence_step_id = null` and the acting user's id, so the
 * log distinguishes them from automated sequence mail. Orders with no email
 * address, or that were cancelled, are reported rather than silently dropped.
 */
export async function sendTemplateToOrdersAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb, user } = await requireOwner();

    const templateId = String(formData.get("templateId") ?? "");
    const orderIds = formData
      .getAll("orderIds")
      .map((value) => String(value))
      .filter(Boolean);

    if (orderIds.length === 0) {
      return { error: "Select at least one order." };
    }

    const template = await tdb.findById(emailTemplates, templateId);
    if (!template) return { fieldErrors: { templateId: "Choose a template." } };
    if (!template.isActive) {
      return { error: "That template is inactive. Activate it before sending." };
    }

    // Tenant-scoped read: ids from another store simply do not come back.
    const selected = await tdb.findMany(orders, {
      where: inArray(orders.id, orderIds),
    });

    let sent = 0;
    const skipped: string[] = [];

    for (const order of selected) {
      if (!order.customerEmail) {
        skipped.push(`${order.orderNumber} (no email address)`);
        continue;
      }
      if (order.cancelledAt) {
        skipped.push(`${order.orderNumber} (cancelled)`);
        continue;
      }

      const row = await tdb.insertOne(emailSends, {
        orderId: order.id,
        sequenceStepId: null,
        templateId: template.id,
        toEmail: order.customerEmail,
        status: "scheduled",
        scheduledFor: new Date(),
        triggeredByUserId: user.id,
      });

      const result = await dispatchEmailSend(row.id);
      if (result.status === "sent") sent += 1;
      else skipped.push(`${order.orderNumber} (${describe(result)})`);
    }

    revalidateEmails();

    if (sent === 0) {
      return {
        error: `Nothing was sent. ${skipped.join("; ")}`,
      };
    }

    return {
      ok: true,
      message:
        `Sent "${template.name}" to ${sent} order${sent === 1 ? "" : "s"}.` +
        (skipped.length > 0 ? ` Skipped: ${skipped.join("; ")}` : ""),
    };
  });
}

function describe(result: Awaited<ReturnType<typeof dispatchEmailSend>>): string {
  if (result.status === "skipped") return result.reason;
  if (result.status === "failed") return result.error;
  return "sent";
}

/** Resends a single logged email that previously failed. */
export async function retryEmailSendAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const sendId = String(formData.get("sendId") ?? "");

    const send = await tdb.findById(emailSends, sendId);
    if (!send) return { error: "That email log entry no longer exists." };
    if (send.status === "sent") return { error: "That email was already sent." };

    await tdb.updateById(emailSends, sendId, {
      status: "scheduled",
      scheduledFor: new Date(),
      error: null,
      updatedAt: new Date(),
    });

    const result = await dispatchEmailSend(sendId);
    revalidateEmails();

    if (result.status === "sent") return { ok: true, message: "Email sent." };
    return { error: `Still not sent: ${describe(result)}` };
  });
}

/** The email log for one order, newest first. */
export async function listOrderEmailSends(orderId: string) {
  const { tdb } = await requireOwner();
  return tdb.raw
    .select({ send: emailSends, templateName: emailTemplates.name })
    .from(emailSends)
    .leftJoin(emailTemplates, eq(emailTemplates.id, emailSends.templateId))
    .where(tdb.scope(emailSends, and(eq(emailSends.orderId, orderId))))
    .orderBy(asc(emailSends.scheduledFor));
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Renders a draft template exactly as it would be sent — same React Email
 * shell, same branding, same merge engine — using example values.
 *
 * Going through the real renderer means the preview cannot drift from what the
 * customer receives.
 */
export async function previewTemplateAction(input: {
  subject: string;
  body: string;
  previewText?: string;
}): Promise<{ subject: string; html: string; unknownTokens: string[] }> {
  const { tdb, store } = await requireOwner();

  const { brandingSettings } = await import("@/lib/db");
  const branding = await tdb.findFirst(brandingSettings);

  const { sampleMergeContext } = await import("@/lib/email/merge");
  const { renderEmail } = await import("@/lib/email/render");

  const context = sampleMergeContext(store.name ?? store.shopDomain);
  const rendered = await renderEmail({
    subject: input.subject,
    body: input.body,
    previewText: input.previewText,
    context,
    branding,
    store,
  });

  return {
    subject: rendered.subject,
    html: rendered.html,
    unknownTokens: [
      ...new Set([
        ...findUnknownMergeTokens(input.subject),
        ...findUnknownMergeTokens(input.body),
      ]),
    ],
  };
}
