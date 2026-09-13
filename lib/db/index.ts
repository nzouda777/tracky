import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env, optional } from "@/lib/env";
import * as schema from "./schema";

/**
 * Single Drizzle client over the Neon serverless HTTP driver.
 *
 * The HTTP driver is stateless, so a module-level singleton is safe on Vercel
 * (both node and edge runtimes) and avoids re-parsing the connection string on
 * every request. It is created lazily so that importing `@/lib/db` in a module
 * that never touches the database does not require DATABASE_URL.
 */
type Database = ReturnType<typeof createClient>;

/**
 * Local development against a plain Postgres container.
 *
 * `@neondatabase/serverless` speaks Neon's HTTP protocol, not the Postgres
 * wire protocol, so it cannot talk to `postgres:5432` directly. Setting
 * NEON_HTTP_ENDPOINT points it at the local Neon HTTP proxy that fronts the
 * container (see docker-compose.yml). Unset in production, where the driver
 * uses Neon's own endpoint derived from DATABASE_URL.
 */
function configureLocalProxy(): void {
  const endpoint = optional("NEON_HTTP_ENDPOINT", "");
  if (!endpoint) return;

  neonConfig.fetchEndpoint = endpoint;
  // The proxy is plain HTTP on a private Docker network / localhost.
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

function createClient() {
  configureLocalProxy();
  const sql = neon(env.databaseUrl);
  return drizzle(sql, { schema, casing: "snake_case" });
}

let client: Database | undefined;

export function getDb(): Database {
  client ??= createClient();
  return client;
}

/**
 * Proxy so callers can write `db.select()` while construction still happens on
 * first use rather than at import time.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb() as object, property, receiver);
  },
});

export { schema };
export * from "./schema";
