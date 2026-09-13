import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only needs the schema, so a placeholder URL keeps
// migration generation working without a live database. `push`/`migrate` do
// need the real DATABASE_URL.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://tracky:tracky@postgres:5432/tracky",
  },
  strict: true,
  verbose: true,
});
