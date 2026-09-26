/**
 * Sends one real confirmation email, end to end, before anything ships.
 *
 *   npx tsx scripts/test-confirmation-email.ts                  # render only
 *   npx tsx scripts/test-confirmation-email.ts --send           # actually send
 *   npx tsx scripts/test-confirmation-email.ts --send <address>
 *   npx tsx scripts/test-confirmation-email.ts --send <shop>    # pick a store
 *
 * It pulls the store's real template, branding and newest order, renders them
 * through the same `renderEmail` production uses, and hands the result to
 * Resend. Nothing is written to `email_sends`: this exercises the pipeline
 * without leaving a fake delivery in the store's history.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 *
 * It proves the pipeline: the key works, the domain is verified, the template
 * renders, Resend accepts, and the message reaches the recipient's provider.
 *
 * It cannot prove inbox placement. Resend reports `delivered` for a message
 * Gmail filed under Spam — the folder is decided after delivery and is
 * invisible to the API. To score placement, pass the address from
 * https://www.mail-tester.com as the recipient and read the report there.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_RECIPIENT = "rodriguenzouda35@gmail.com";

type Check = { label: string; ok: boolean };

const checks: Check[] = [];

function check(label: string, ok: boolean, detail: string): void {
  checks.push({ label, ok });
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(20)} ${detail}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const send = args.includes("--send");
  const recipient = args.find((arg) => arg.includes("@")) ?? DEFAULT_RECIPIENT;
  const shop = args.find((arg) => !arg.startsWith("--") && !arg.includes("@"));

  const apiKey = process.env.RESEND_API_KEY ?? "";
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";
  const fromName = process.env.RESEND_FROM_NAME ?? "Tracky";
  const replyTo = process.env.RESEND_REPLY_TO ?? "";

  console.log("preflight");
  check(
    "RESEND_API_KEY",
    apiKey.startsWith("re_"),
    apiKey ? `${apiKey.slice(0, 6)}... (${apiKey.length} chars)` : "missing",
  );
  check("RESEND_FROM_EMAIL", /.+@.+\..+/.test(fromEmail), fromEmail || "missing");
  // Every template ends by inviting a reply. With no reply-to, replies go to
  // the From address, which on this domain is refused at RCPT time.
  check(
    "RESEND_REPLY_TO",
    Boolean(replyTo),
    replyTo || "unset - customer replies will bounce",
  );

  if (apiKey.startsWith("re_")) {
    const domain = fromEmail.split("@")[1] ?? "";
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const body = (await response.json()) as {
        data?: Array<{ name: string; status: string }>;
      };
      const match = body.data?.find(
        (entry) => domain === entry.name || domain.endsWith(`.${entry.name}`),
      );
      check(
        "sending domain",
        match?.status === "verified",
        match
          ? `${match.name} -> ${match.status}`
          : `${domain} is not on this Resend account`,
      );
    } catch (error) {
      check(
        "sending domain",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // --- the store's own data -------------------------------------------------
  const { db, orders, stores, stages, brandingSettings, emailTemplates } =
    await import("../lib/db");
  const { and, asc, desc, eq } = await import("drizzle-orm");
  const { renderEmail } = await import("../lib/email/render");
  const { buildMergeContext } = await import("../lib/email/merge");
  const { buildTrackingLink } = await import("../lib/tracking/links");

  const allStores = await db.select().from(stores);
  if (!allStores.length) throw new Error("No store in the database.");

  // Default to whichever store owns the newest order.
  //
  // A deployment normally also carries the seeded demo store, and picking the
  // first active row lands on that one — rendering fixture data and proving
  // nothing about the store actually taking traffic.
  const [newest] = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(1);

  const store = shop
    ? allStores.find((row) => row.shopDomain.includes(shop))
    : (allStores.find((row) => row.id === newest?.storeId) ?? allStores[0]);
  if (!store) {
    throw new Error(
      `No store matching "${shop}". Known: ${allStores.map((r) => r.shopDomain).join(", ")}`,
    );
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.storeId, store.id))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!order) throw new Error(`No order on ${store.shopDomain} to render.`);

  const [branding] = await db
    .select()
    .from(brandingSettings)
    .where(eq(brandingSettings.storeId, store.id))
    .limit(1);

  const allStages = await db
    .select()
    .from(stages)
    .where(eq(stages.storeId, store.id))
    .orderBy(asc(stages.position));
  const stage = allStages.find((row) => row.id === order.currentStageId) ?? null;

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.storeId, store.id),
        eq(emailTemplates.key, "order-confirmation"),
      ),
    )
    .limit(1);
  if (!template) {
    throw new Error(`No "order-confirmation" template on ${store.shopDomain}.`);
  }

  // Not fatal: an empty address only omits the footer line. It is surfaced
  // because that line is a legal requirement the store has not met yet.
  check(
    "postal address",
    Boolean(branding?.postalAddress?.trim()),
    branding?.postalAddress?.trim() || "empty - the footer line is omitted",
  );

  const rendered = await renderEmail({
    subject: template.subject,
    body: template.body,
    previewText: template.previewText,
    branding: branding ?? null,
    store,
    context: buildMergeContext({
      order,
      store,
      stage,
      trackingLink: buildTrackingLink(store, order),
    }),
  });

  // Mirrors the From built in lib/email/send.ts. If that changes, this drifts,
  // which is why the value is printed rather than assumed correct.
  const from = `${store.name ?? fromName} <${fromEmail}>`;

  console.log("\nmessage");
  console.log(`  from      ${from}`);
  console.log(`  reply-to  ${replyTo || "(none)"}`);
  console.log(`  to        ${recipient}`);
  console.log(`  subject   ${rendered.subject}`);
  console.log(
    `  source    ${store.name} (${store.shopDomain}), order ${order.orderNumber}`,
  );

  const linkOrigins = [
    ...new Set(
      [...rendered.html.matchAll(/href="(https?:\/\/[^/"]+)/g)].map((m) => m[1]),
    ),
  ];
  console.log(`  links     ${linkOrigins.join(", ") || "(none)"}`);

  const fromDomain = fromEmail.split("@")[1] ?? "";
  if (fromDomain && !linkOrigins.some((origin) => origin.includes(fromDomain))) {
    console.log(
      `            note: nothing links to ${fromDomain}. A From domain that shares`,
    );
    console.log(
      `            nothing with the links is a signal filters weigh against you.`,
    );
  }

  const preview = path.join(
    tmpdir(),
    `tracky-confirmation-${order.orderNumber.replace(/\W/g, "")}.html`,
  );
  writeFileSync(preview, rendered.html, "utf8");
  console.log(`  preview   ${preview}`);

  const failed = checks.filter((entry) => !entry.ok);

  if (!send) {
    console.log(`\nRendered only. Re-run with --send to deliver to ${recipient}.`);
    if (failed.length) {
      console.log(
        `${failed.length} preflight check(s) failing: ${failed.map((e) => e.label).join(", ")}`,
      );
    }
    return;
  }

  const blocking = failed.filter((entry) => entry.label !== "postal address");
  if (blocking.length) {
    console.error(
      `\nRefusing to send: ${blocking.map((e) => e.label).join(", ")} must pass first.`,
    );
    process.exit(1);
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const response = await resend.emails.send({
    from,
    ...(replyTo ? { replyTo: [replyTo] } : {}),
    to: [recipient],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { "X-Entity-Ref-ID": `test-${Date.now()}` },
  });

  if (response.error) {
    console.error(`\nResend refused it: ${response.error.message}`);
    process.exit(1);
  }

  const id = response.data?.id;
  console.log(`\nAccepted by Resend: ${id}`);

  // Accepted is not delivered. Poll until the provider reports something else.
  for (const wait of [3000, 5000, 8000, 12000]) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    const res = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = (await res.json()) as { last_event?: string };
    const event = body.last_event ?? "(none)";
    console.log(`  last_event: ${event}`);
    if (event !== "sent" && event !== "(none)") break;
  }

  console.log(
    `\n"delivered" means it reached the provider, not that it reached the inbox.` +
      `\nOpen ${recipient} and look in Spam and Promotions, not only the inbox.` +
      `\nFor a placement score, send to an address from https://www.mail-tester.com:` +
      `\n  npx tsx scripts/test-confirmation-email.ts --send <that address>`,
  );
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exit(1);
});
