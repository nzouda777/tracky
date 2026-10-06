/**
 * Renders the Hooma template set to HTML files for a visual check.
 *
 *   npx tsx scripts/render-hooma-preview.ts <output dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { HOOMA_TEMPLATE_SET } from "@/lib/email/designs/hooma-options";
import { sampleMergeContext } from "@/lib/email/merge";
import { SAMPLE_ORDER_FACTS } from "@/lib/email/order-facts";
import { renderEmail } from "@/lib/email/render";

async function main() {
  const out = process.argv[2] ?? "hooma-preview";
  mkdirSync(out, { recursive: true });

  const context = {
    ...sampleMergeContext("HOOMA"),
    customer_first_name: "Vic",
    customer_name: "Vic Martin",
    order_number: "JAUD9LF",
  };

  for (const [index, template] of HOOMA_TEMPLATE_SET.entries()) {
    const rendered = await renderEmail({
      subject: template.subject,
      body: template.body,
      previewText: template.previewText,
      design: "hooma",
      designOptions: template.options,
      order: { ...SAMPLE_ORDER_FACTS, total: "USD 7.98", placedAt: "6/25/2026, 6:43:09 AM" },
      context,
      branding: null,
      store: { name: "hooma.", shopDomain: "hooma.myshopify.com" },
    });
    const file = path.join(out, `${index + 1}.html`);
    writeFileSync(file, rendered.html);
    console.log(`${file}  ${rendered.subject}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
