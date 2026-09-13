import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db, users, type User } from "@/lib/db";
import { optional } from "@/lib/env";
import { getCurrentUser } from "./session";

/**
 * Platform operator access — the one role that reads across every store.
 *
 * Everything else in this app is tenant-scoped by construction: application
 * code goes through `TenantDb`, which pins `store_id` on every statement.
 * This role deliberately steps outside that, so it is deliberately awkward to
 * obtain:
 *
 *   - it is **never self-service**. No screen grants it, and no invitation
 *     carries it. It comes from a column set by hand, or from an address
 *     listed in `PLATFORM_ADMIN_EMAILS` at deploy time.
 *   - it is **read-only by design**. The /platform screens run aggregate
 *     queries and link out; they never mutate another store's data. To change
 *     a store's settings you still sign in with access to that store.
 *   - a non-operator gets **404, not 403**: the panel does not announce its
 *     own existence to someone who cannot use it.
 */
export type PlatformSession = {
  user: User;
  /** How the grant was obtained, shown in the panel so it is never a mystery. */
  grantedBy: "database" | "environment";
};

/** Addresses granted the role by deployment config, lower-cased. */
function allowlist(): string[] {
  return optional("PLATFORM_ADMIN_EMAILS", "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Resolves platform access without throwing; used to decide whether to show a link. */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.isPlatformAdmin) return { user, grantedBy: "database" };
  if (allowlist().includes(user.email.toLowerCase())) {
    return { user, grantedBy: "environment" };
  }
  return null;
}

/**
 * Guard for every /platform page and action.
 *
 * Returns 404 rather than redirecting to a sign-in page or showing a
 * permission error: to a store owner who is not an operator, /platform simply
 * does not exist.
 */
export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const session = await getPlatformSession();
  if (!session) notFound();
  return session;
}

/**
 * Grants the role to an existing account. Deliberately not exposed through any
 * UI — call it from a script or a psql session.
 */
export async function grantPlatformAdmin(email: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ isPlatformAdmin: true, updatedAt: new Date() })
    .where(eq(users.email, email.trim().toLowerCase()))
    .returning({ id: users.id });
  return rows.length > 0;
}
