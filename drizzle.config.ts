import { defineConfig } from "drizzle-kit";

import { resolveMigrationUrl } from "./lib/db/migration-url";

// `drizzle-kit generate` only needs the schema, so a placeholder URL keeps
// migration generation working without a live database. `push`/`migrate` do
// need the real DATABASE_URL.
//
// The URL goes through `resolveMigrationUrl` so DDL runs over Neon's direct
// endpoint rather than its pooler, with the TLS mode written out. A non-Neon
// URL — the Docker fallback below, or a plain local Postgres — is passed
// through unchanged.
const url = resolveMigrationUrl(
  process.env.DATABASE_URL ?? "postgres://tracky:tracky@postgres:5432/tracky",
);

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
