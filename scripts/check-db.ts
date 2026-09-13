/**
 * Checks that the database matches the code.
 *
 *   npm run db:check
 *
 * Deploying code that expects a column the database does not have produces a
 * raw `column "x" does not exist` at the first request — cryptic, and it
 * surfaces as a 500 on a page rather than as a deployment problem. This
 * compares the migrations on disk with the ones the database has applied, and
 * says plainly which is ahead.
 *
 * Run it after `db:migrate`, and before or after a deploy. It is read-only.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type JournalEntry = { idx: number; tag: string; when: number };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }

  // Say which database, without ever printing the password.
  console.log(`Database: ${describe(url)}\n`);

  const onDisk = readJournal();
  const applied = await readApplied(url);

  console.log(`Migrations on disk:     ${onDisk.length}`);
  console.log(`Applied in database:    ${applied}\n`);

  if (applied === onDisk.length) {
    console.log("✓ Database and code are in step.");
    return;
  }

  if (applied < onDisk.length) {
    const pending = onDisk.slice(applied);
    console.error(
      `✗ ${pending.length} migration(s) have not been applied:\n` +
        pending.map((entry) => `    ${entry.tag}`).join("\n") +
        "\n\nThe app will fail on any query touching the new schema.\n" +
        "Apply them with:\n" +
        "    npm run db:migrate\n",
    );
    process.exitCode = 1;
    return;
  }

  console.error(
    `✗ The database has ${applied - onDisk.length} migration(s) this checkout ` +
      "does not know about.\nYou are probably on an older branch than the " +
      "database. Pull, or point at a different database.\n",
  );
  process.exitCode = 1;
}

/** Migration files, in order, from drizzle's own journal. */
function readJournal(): JournalEntry[] {
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };

  // Cross-check against the .sql files actually present, so a half-committed
  // migration is caught rather than silently counted.
  const sqlFiles = readdirSync(path.join(process.cwd(), "drizzle")).filter(
    (name) => name.endsWith(".sql"),
  );
  if (sqlFiles.length !== journal.entries.length) {
    console.warn(
      `! The journal lists ${journal.entries.length} migration(s) but ${sqlFiles.length} .sql file(s) are present.\n`,
    );
  }

  return journal.entries;
}

async function readApplied(url: string): Promise<number> {
  const { neon } = await import("@neondatabase/serverless");
  const endpoint = process.env.NEON_HTTP_ENDPOINT;

  if (endpoint) {
    const { neonConfig } = await import("@neondatabase/serverless");
    neonConfig.fetchEndpoint = endpoint;
  }

  const sql = neon(url);

  try {
    const rows = (await sql`
      select count(*)::int as n from drizzle.__drizzle_migrations
    `) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // No migrations table at all means nothing has ever been applied.
    if (/does not exist/i.test(message)) return 0;
    throw error;
  }
}

/** `neondb on ep-lucky-silence…aws.neon.tech` — never the credentials. */
function describe(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname.replace(/^\//, "")} on ${parsed.hostname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

main().catch((error) => {
  console.error("\nCheck failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
