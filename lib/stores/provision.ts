import { eq } from "drizzle-orm";

import {
  brandingSettings,
  db,
  emailSequenceSteps,
  emailTemplates,
  fulfillmentRules,
  stages,
} from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/templates/defaults";
import { DEFAULT_STAGES } from "@/lib/stages/defaults";

/**
 * Gives a freshly connected store its own independent starting configuration:
 * stages, branding, email templates, a default sequence and fulfillment rules.
 *
 * Idempotent per resource — re-running it on a store that already has stages
 * leaves them alone, so a reinstall never clobbers a live configuration. This
 * is what makes Phase 10 work: every store owns its own rows, nothing is
 * shared or hard-coded, and adding a store needs no deploy.
 */
export async function provisionStoreDefaults(storeId: string): Promise<void> {
  await Promise.all([
    provisionStages(storeId),
    provisionBranding(storeId),
    provisionFulfillmentRules(storeId),
  ]);
  // Sequence steps reference both templates and stages, so they come last.
  await provisionEmailTemplatesAndSequence(storeId);
}

async function provisionStages(storeId: string): Promise<void> {
  const existing = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.storeId, storeId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(stages).values(
    DEFAULT_STAGES.map((stage, index) => ({
      storeId,
      key: stage.key,
      name: stage.name,
      description: stage.description,
      position: index,
      icon: stage.icon,
      color: stage.color,
      isTerminal: stage.isTerminal ?? false,
      triggersFulfillment: stage.triggersFulfillment ?? false,
      locksAddressEditing: stage.locksAddressEditing ?? false,
    })),
  );
}

async function provisionBranding(storeId: string): Promise<void> {
  await db
    .insert(brandingSettings)
    .values({
      storeId,
      faq: [
        {
          question: "When will my order arrive?",
          answer:
            "Your tracking timeline updates as soon as our delivery team reports progress. You will also receive an email at every step.",
        },
        {
          question: "Can I change my delivery address?",
          answer:
            "Yes, until your order is out for delivery. Use the Edit address button on this page.",
        },
        {
          question: "Do I need to sign for my delivery?",
          answer:
            "Yes. Our driver will ask you to sign the paper delivery note when your order arrives.",
        },
      ],
    })
    .onConflictDoNothing({ target: brandingSettings.storeId });
}

async function provisionFulfillmentRules(storeId: string): Promise<void> {
  await db
    .insert(fulfillmentRules)
    .values({
      storeId,
      enabled: true,
      // The product promise: no fulfillment without a confirmed delivery.
      requireDeliveryConfirmation: true,
    })
    .onConflictDoNothing({ target: fulfillmentRules.storeId });
}

async function provisionEmailTemplatesAndSequence(
  storeId: string,
): Promise<void> {
  const existing = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(eq(emailTemplates.storeId, storeId))
    .limit(1);
  if (existing.length > 0) return;

  const inserted = await db
    .insert(emailTemplates)
    .values(
      DEFAULT_EMAIL_TEMPLATES.map((template) => ({
        storeId,
        key: template.key,
        name: template.name,
        subject: template.subject,
        previewText: template.previewText,
        body: template.body,
        isActive: true,
      })),
    )
    .returning({ id: emailTemplates.id, key: emailTemplates.key });

  const templateByKey = new Map(inserted.map((row) => [row.key, row.id]));

  const storeStages = await db
    .select({ id: stages.id, key: stages.key })
    .from(stages)
    .where(eq(stages.storeId, storeId));
  const stageByKey = new Map(storeStages.map((row) => [row.key, row.id]));

  const steps: (typeof emailSequenceSteps.$inferInsert)[] = [];

  DEFAULT_EMAIL_TEMPLATES.forEach((template, index) => {
    const templateId = templateByKey.get(template.key);
    if (!templateId) return;

    if (template.trigger.type === "on_stage") {
      const stageId = stageByKey.get(template.trigger.stageKey);
      if (!stageId) return;
      steps.push({
        storeId,
        templateId,
        triggerType: "on_stage",
        stageId,
        delayDays: null,
        position: index,
        isActive: true,
      });
      return;
    }

    steps.push({
      storeId,
      templateId,
      triggerType: "delay_after_order",
      stageId: null,
      delayDays: template.trigger.delayDays,
      position: index,
      isActive: true,
    });
  });

  if (steps.length > 0) {
    await db.insert(emailSequenceSteps).values(steps);
  }
}
