import { desc, eq, or } from "drizzle-orm";

import {
  db,
  platformAuditLog,
  type PlatformAction,
  type PlatformAuditEntry,
} from "@/lib/db";
import type { PlatformSession } from "@/lib/auth/platform";

/**
 * The platform audit trail.
 *
 * Operators can act across every tenant, so every one of those actions is
 * recorded before it is considered done. Two rules make the trail worth
 * having:
 *
 *   1. **Append only.** This module exposes a write and two reads, and
 *      nothing else. There is no update or delete path anywhere in the
 *      application — a log the operator can edit proves nothing.
 *   2. **Self-contained rows.** The actor's email and a label for the target
 *      are copied in at write time, so the entry still reads correctly after
 *      the store is deleted or the account is gone.
 */
export async function recordPlatformAction({
  session,
  action,
  targetLabel,
  targetStoreId,
  targetUserId,
  reason,
  metadata,
}: {
  session: PlatformSession;
  action: PlatformAction;
  targetLabel: string;
  targetStoreId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(platformAuditLog).values({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action,
    targetStoreId: targetStoreId ?? null,
    targetUserId: targetUserId ?? null,
    targetLabel,
    reason: reason?.trim() ? reason.trim() : null,
    metadata: metadata ?? null,
  });
}

export type AuditFilter = {
  storeId?: string;
  userId?: string;
  limit?: number;
};

export async function listPlatformAudit({
  storeId,
  userId,
  limit = 100,
}: AuditFilter = {}): Promise<PlatformAuditEntry[]> {
  const where =
    storeId && userId
      ? or(
          eq(platformAuditLog.targetStoreId, storeId),
          eq(platformAuditLog.targetUserId, userId),
        )
      : storeId
        ? eq(platformAuditLog.targetStoreId, storeId)
        : userId
          ? eq(platformAuditLog.targetUserId, userId)
          : undefined;

  const query = db
    .select()
    .from(platformAuditLog)
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(Math.min(limit, 500))
    .$dynamic();

  return where ? query.where(where) : query;
}

/** Sentence-case description of an action, for the log table. */
export const ACTION_LABELS: Record<PlatformAction, string> = {
  "store.suspend": "Suspended store",
  "store.resume": "Resumed store",
  "store.disconnect": "Disconnected store from Shopify",
  "store.note": "Updated internal note",
  "store.credentials": "Replaced Shopify app credentials",
  "user.disable": "Disabled account",
  "user.enable": "Re-enabled account",
  "user.grant_platform_admin": "Granted platform access",
  "user.revoke_platform_admin": "Revoked platform access",
  "membership.revoke": "Removed store access",
  "membership.role_change": "Changed store role",
};

/** Actions that take something away, shown in a warmer tone in the log. */
export const DESTRUCTIVE_ACTIONS = new Set<PlatformAction>([
  "store.suspend",
  "store.disconnect",
  "user.disable",
  "user.revoke_platform_admin",
  "membership.revoke",
]);
