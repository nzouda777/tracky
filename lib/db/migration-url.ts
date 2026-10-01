/**
 * The connection string migrations should run over.
 *
 * Two things make the pooled endpoint the wrong one for DDL:
 *
 *   - Neon's `-pooler` host is PgBouncer in transaction mode. It is built for
 *     short application queries, and Neon's own guidance is to point schema
 *     migrations at the direct endpoint instead.
 *   - When that connection is refused, `drizzle-kit migrate` exits 1 having
 *     printed nothing at all. A migration that silently did not apply is worse
 *     than one that failed loudly, because the next deploy queries a column
 *     that is not there.
 *
 * It also pins `sslmode=verify-full`. Today `pg` treats `require` as an alias
 * for it, but `pg` v9 will adopt libpq semantics, where `require` encrypts
 * without verifying who is on the other end. Writing it out keeps the current
 * behaviour when that day comes rather than quietly weakening it.
 *
 * Anything that is not a Neon host is returned untouched — the Docker
 * `postgres://tracky:tracky@postgres:5432/tracky` fallback has no TLS at all,
 * and forcing a mode on it would break local development.
 */
export function resolveMigrationUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not a URL we can reason about. Hand it back and let the driver complain
    // in its own words.
    return raw;
  }

  if (!isNeonHost(url.hostname)) return raw;

  // `ep-name-1234-pooler.c-5.region.aws.neon.tech` -> `ep-name-1234.c-5.…`.
  // Anchored to the first label so a `-pooler` appearing anywhere else in the
  // host is left alone.
  url.hostname = url.hostname.replace(/^([^.]*?)-pooler\./, "$1.");
  url.searchParams.set("sslmode", "verify-full");

  return url.toString();
}

/** Whether this host is served by Neon, and so speaks TLS with a real cert. */
export function isNeonHost(hostname: string): boolean {
  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}

/** `neondb on ep-lucky-silence….aws.neon.tech` — never the credentials. */
export function describeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const database = url.pathname.replace(/^\//, "") || "(no database)";
    return `${database} on ${url.hostname}`;
  } catch {
    return "(unparseable connection string)";
  }
}
