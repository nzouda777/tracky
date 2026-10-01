import { render } from "@react-email/render";

import type { BrandingSettings, Store } from "@/lib/db";
import { layoutFor } from "./designs";
import { buildEmailModel } from "./designs/shared";
import { applyMergeFields, type MergeContext } from "./merge";

/**
 * Wraps a store's editable HTML body in a branded email layout.
 *
 * The body is admin-authored HTML with merge tokens; the surrounding shell —
 * wordmark, headline, call to action, delivery panel, footer — comes from the
 * template's design (`lib/email/designs`), `branding_settings` and the merge
 * context. Swapping the design restyles the message without touching its copy.
 *
 * Three rules every design is built around, each one a thing that makes a
 * transactional email look amateur:
 *
 *   1. **One call to action.** The shell owns the button, so a template body
 *      never has to carry its own link.
 *   2. **Say each fact once.** The order number, the stage and the address each
 *      have one home in the shell.
 *   3. **Nothing depends on CSS an email client might drop.** Every rule is
 *      inline, including the ones applied to the admin's own HTML, because a
 *      `<style>` block is the first thing Outlook and Gmail throw away.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

/** Applies merge fields and renders the final HTML + plain-text alternative. */
export async function renderEmail({
  subject,
  body,
  previewText,
  context,
  branding,
  store,
  design,
}: {
  subject: string;
  body: string;
  previewText?: string;
  context: MergeContext;
  branding: BrandingSettings | null;
  store: Pick<Store, "name" | "shopDomain">;
  /** A design id from `EMAIL_DESIGNS`; missing or unknown means the default. */
  design?: string | null;
}): Promise<RenderedEmail> {
  const mergedSubject = applyMergeFields(subject, context, { escape: false });
  const mergedBody = applyMergeFields(body, context, { escape: true });
  const mergedPreview = applyMergeFields(previewText ?? "", context, {
    escape: false,
  });

  const Layout = layoutFor(design);
  const element = (
    <Layout
      model={buildEmailModel({
        branding,
        store,
        previewText: mergedPreview,
        html: mergedBody,
        context,
      })}
    />
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: mergedSubject, html, text };
}
