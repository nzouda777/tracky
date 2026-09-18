"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import { brandingSettings, type ContentAlignment } from "@/lib/db";
import { guard, type ActionResult } from "./result";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function colour(
  formData: FormData,
  field: string,
  fallback: string,
): string {
  const value = String(formData.get(field) ?? "").trim();
  return HEX.test(value) ? value : fallback;
}

function clampInt(
  formData: FormData,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(formData.get(field));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** An optional colour: blank clears it, anything malformed is ignored. */
function optionalColour(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  return HEX.test(value) ? value : null;
}

/** Only http(s) URLs are accepted, so a logo field cannot carry `javascript:`. */
function safeUrl(formData: FormData, field: string): string | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Saves the store's branding. Every field is validated and clamped here rather
 * than trusted, because these values are injected into the public tracking
 * page as CSS and markup.
 */
export async function updateBrandingAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();

    const existing = await tdb.findFirst(brandingSettings);

    const values = {
      primaryColor: colour(formData, "primaryColor", "#111827"),
      secondaryColor: colour(formData, "secondaryColor", "#6b7280"),
      backgroundColor: colour(formData, "backgroundColor", "#ffffff"),
      textColor: colour(formData, "textColor", "#111827"),
      accentColor: colour(formData, "accentColor", "#2563eb"),
      logoUrl: safeUrl(formData, "logoUrl"),
      fontFamily:
        String(formData.get("fontFamily") ?? "").trim() ||
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      baseFontSize: clampInt(formData, "baseFontSize", 16, 12, 22),
      headingFontSize: clampInt(formData, "headingFontSize", 24, 16, 48),
      pageTitle:
        String(formData.get("pageTitle") ?? "").trim() || "Track your order",
      pageSubtitle: String(formData.get("pageSubtitle") ?? "").trim(),
      helpBannerText: String(formData.get("helpBannerText") ?? "").trim(),
      helpBannerUrl: safeUrl(formData, "helpBannerUrl"),
      footerText: String(formData.get("footerText") ?? "").trim(),
      faq: readFaq(formData),
      showOrderSummary: formData.get("showOrderSummary") === "on",
      showAddressEditing: formData.get("showAddressEditing") === "on",

      // --- Layout ---------------------------------------------------------
      // Every one of these ends up in a stylesheet on a customer-facing page,
      // so each is clamped to a range that cannot produce a broken layout —
      // a 4000px column or a negative radius is not a style, it is a bug the
      // merchant cannot see until someone tries to track an order.
      contentAlignment: (formData.get("contentAlignment") === "left"
        ? "left"
        : "center") as ContentAlignment,
      showStoreName: formData.get("showStoreName") === "on",
      contentWidth: clampInt(formData, "contentWidth", 640, 420, 960),
      cardRadius: clampInt(formData, "cardRadius", 14, 0, 32),
      buttonRadius: clampInt(formData, "buttonRadius", 10, 0, 40),
      buttonFullWidth: formData.get("buttonFullWidth") === "on",
      sectionBackground: optionalColour(formData, "sectionBackground"),
      updatedAt: new Date(),
    };

    if (existing) {
      await tdb.updateById(brandingSettings, existing.id, values);
    } else {
      await tdb.insertOne(brandingSettings, values);
    }

    revalidatePath("/admin/branding");
    return { ok: true, message: "Branding saved." };
  });
}

/** FAQ rows arrive as parallel `faqQuestion` / `faqAnswer` fields. */
function readFaq(formData: FormData): Array<{ question: string; answer: string }> {
  const questions = formData.getAll("faqQuestion").map((v) => String(v).trim());
  const answers = formData.getAll("faqAnswer").map((v) => String(v).trim());

  return questions
    .map((question, index) => ({ question, answer: answers[index] ?? "" }))
    .filter((entry) => entry.question.length > 0)
    .slice(0, 20);
}

/** Resets the store's branding back to the shipped defaults. */
export async function resetBrandingAction(): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();
    const existing = await tdb.findFirst(brandingSettings);
    if (existing) {
      await tdb.deleteById(brandingSettings, existing.id);
    }
    await tdb.insertOne(brandingSettings, {});

    revalidatePath("/admin/branding");
    return { ok: true, message: "Branding reset to defaults." };
  });
}
