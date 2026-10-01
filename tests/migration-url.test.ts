import { describe, expect, it } from "vitest";

import {
  describeUrl,
  isNeonHost,
  resolveMigrationUrl,
} from "@/lib/db/migration-url";

/**
 * Migrations run over the direct endpoint, everything else is left alone.
 *
 * `drizzle-kit migrate` used to talk to Neon's `-pooler` host — PgBouncer in
 * transaction mode, which Neon tells you not to point schema changes at. When
 * it refused the connection, drizzle-kit exited 1 having printed nothing,
 * which is indistinguishable from a run with nothing to do.
 *
 * The rewrite is narrow on purpose. This file's real job is the third block:
 * a connection string that is not Neon's must come back byte for byte, because
 * the Docker fallback speaks no TLS and a forced `sslmode` would break local
 * development for everyone.
 */

const POOLED =
  "postgres://alice:s3cr3t@ep-lucky-silence-aytjhv35-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

describe("Neon: migrations go to the direct endpoint", () => {
  it("drops -pooler from the endpoint host", () => {
    const resolved = new URL(resolveMigrationUrl(POOLED));
    expect(resolved.hostname).toBe(
      "ep-lucky-silence-aytjhv35.c-5.us-east-2.aws.neon.tech",
    );
  });

  it("writes the TLS mode out in full", () => {
    // `require` is an alias for `verify-full` in pg 8 and will mean something
    // weaker in pg 9. Stating it keeps today's behaviour when that lands.
    const resolved = new URL(resolveMigrationUrl(POOLED));
    expect(resolved.searchParams.get("sslmode")).toBe("verify-full");
  });

  it("keeps the credentials, database and every other parameter", () => {
    const resolved = new URL(resolveMigrationUrl(POOLED));
    expect(resolved.username).toBe("alice");
    expect(resolved.password).toBe("s3cr3t");
    expect(resolved.pathname).toBe("/neondb");
    // Neon recommends channel binding alongside verify-full; losing it here
    // would be a silent downgrade.
    expect(resolved.searchParams.get("channel_binding")).toBe("require");
  });

  it("leaves an already-direct endpoint's host alone", () => {
    const direct = POOLED.replace("-pooler", "");
    const resolved = new URL(resolveMigrationUrl(direct));
    expect(resolved.hostname).toBe(
      "ep-lucky-silence-aytjhv35.c-5.us-east-2.aws.neon.tech",
    );
    expect(resolved.searchParams.get("sslmode")).toBe("verify-full");
  });

  it("only strips -pooler from the endpoint label", () => {
    // A later label that happens to contain the word must survive, or the
    // rewrite would invent a host that does not resolve.
    const odd =
      "postgres://u:p@ep-abc.c-5.my-pooler.aws.neon.tech/neondb?sslmode=require";
    expect(new URL(resolveMigrationUrl(odd)).hostname).toBe(
      "ep-abc.c-5.my-pooler.aws.neon.tech",
    );
  });
});

describe("anything that is not Neon is untouched", () => {
  it("returns the Docker fallback byte for byte", () => {
    // The regression this file exists to prevent. This Postgres has no TLS at
    // all: adding sslmode=verify-full would refuse to connect, and every
    // `npm run db:migrate` in Docker would stop working.
    const docker = "postgres://tracky:tracky@postgres:5432/tracky";
    expect(resolveMigrationUrl(docker)).toBe(docker);
  });

  it("returns a plain localhost string byte for byte", () => {
    const local = "postgres://postgres@localhost:5432/tracky";
    expect(resolveMigrationUrl(local)).toBe(local);
  });

  it("hands back something unparseable rather than guessing", () => {
    expect(resolveMigrationUrl("not a url")).toBe("not a url");
  });

  it("recognises Neon hosts and nothing else", () => {
    expect(isNeonHost("ep-x.c-5.us-east-2.aws.neon.tech")).toBe(true);
    expect(isNeonHost("neon.tech")).toBe(true);
    expect(isNeonHost("postgres")).toBe(false);
    expect(isNeonHost("localhost")).toBe(false);
    // Not a suffix match on a lookalike domain.
    expect(isNeonHost("notneon.tech")).toBe(false);
    expect(isNeonHost("neon.tech.example.com")).toBe(false);
  });
});

describe("describeUrl never prints the password", () => {
  it("names the database and host only", () => {
    const described = describeUrl(POOLED);
    expect(described).toContain("neondb");
    expect(described).toContain("neon.tech");
    expect(described).not.toContain("s3cr3t");
    expect(described).not.toContain("alice");
  });

  it("says so plainly when it cannot parse the string", () => {
    expect(describeUrl("nonsense")).toMatch(/unparseable/i);
  });
});
