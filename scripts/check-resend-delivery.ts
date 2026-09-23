/**
 * What Resend did with the messages we handed it.
 *
 * `email_sends.status = 'sent'` means one thing only: Resend's API accepted the
 * request and gave us an id. It says nothing about whether the message reached
 * the inbox. Resend keeps a suppression list — an address that once hard
 * bounced or reported spam is accepted and silently dropped, with an id
 * returned exactly as if it had been delivered. That failure is invisible from
 * our database, which is why this script exists.
 *
 *   npx tsx scripts/check-resend-delivery.ts [count]
 *
 * Needs RESEND_API_KEY in the environment (it lives on Vercel, not in .env):
 *   npx vercel link && npx vercel env pull .env.local
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type ResendEmail = {
  id: string;
  to: string[] | string;
  from: string;
  subject: string;
  /** delivered | bounced | complained | delivery_delayed | sent | … */
  last_event?: string;
  created_at?: string;
};

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not set.\n" +
        "Pull it from the deployment:  npx vercel link && npx vercel env pull .env.local",
    );
    process.exit(1);
  }

  const count = Number(process.argv[2] ?? 15);
  const { db, emailSends, orders } = await import("../lib/db");
  const { desc, eq, isNotNull, and } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(emailSends)
    .where(and(eq(emailSends.status, "sent"), isNotNull(emailSends.providerMessageId)))
    .orderBy(desc(emailSends.sentAt))
    .limit(count);

  if (!rows.length) {
    console.log("No sent messages with a provider id.");
    return;
  }

  console.log(
    `order    recipient                       resend says      subject`,
  );

  const verdicts = new Map<string, number>();

  for (const row of rows) {
    const [order] = row.orderId
      ? await db.select().from(orders).where(eq(orders.id, row.orderId)).limit(1)
      : [];

    let verdict: string;
    try {
      const response = await fetch(
        `https://api.resend.com/emails/${row.providerMessageId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!response.ok) {
        verdict = `http ${response.status}`;
      } else {
        const email = (await response.json()) as ResendEmail;
        verdict = email.last_event ?? "(no event)";
      }
    } catch (error) {
      verdict = error instanceof Error ? error.message : String(error);
    }

    verdicts.set(verdict, (verdicts.get(verdict) ?? 0) + 1);
    console.log(
      `${(order?.orderNumber ?? "-").padEnd(8)} ${String(row.toEmail).padEnd(31)} ` +
        `${verdict.padEnd(16)} ${row.subject ?? ""}`,
    );
  }

  console.log("\nsummary");
  for (const [verdict, n] of [...verdicts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${verdict}`);
  }
  console.log(
    "\n  delivered        → it reached the mail server; look in Spam/Promotions.\n" +
      "  bounced          → the address rejected it; it is now suppressed.\n" +
      "  complained       → marked as spam; Resend will keep dropping it.\n" +
      "  sent / no event  → accepted but never delivered — the suppression case.",
  );
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exit(1);
});
