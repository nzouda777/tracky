"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { db, storeMemberships, stores, users } from "@/lib/db";
import { recordPlatformAction } from "@/lib/platform/audit";
import { guard, type ActionResult } from "./result";

/**
 * Platform operator commands.
 *
 * Separate from `lib/platform/queries.ts`, which stays strictly read-only:
 * reads are aggregates over every tenant, writes are deliberate, audited, one
 * target at a time. Keeping them in different files means "does the platform
 * panel write?" is answerable by looking at one import.
 *
 * Every function here:
 *   - starts with `requirePlatformAdmin()`, which 404s for anyone else;
 *   - writes a `platform_audit_log` row naming the operator and the target;
 *   - refuses the moves that would lock the platform out of itself.
 */

function revalidatePlatform(storeId?: string, userId?: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/stores");
  revalidatePath("/platform/users");
  revalidatePath("/platform/audit");
  if (storeId) revalidatePath(`/platform/stores/${storeId}`);
  if (userId) revalidatePath(`/platform/users/${userId}`);
}

function reasonOf(formData: FormData): string {
  return String(formData.get("reason") ?? "").trim();
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/**
 * Holds a store: nobody can open its backoffice or dispatch screens.
 *
 * Webhooks keep being accepted while it is suspended, so orders placed during
 * the hold still arrive and nothing has to be back-filled on resume. That is
 * the whole reason this is not implemented as an uninstall.
 */
export async function suspendStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const storeId = String(formData.get("storeId") ?? "");
    const reason = reasonOf(formData);

    if (!reason) {
      return {
        fieldErrors: {
          reason: "Give a reason — it is what the audit log will show.",
        },
      };
    }

    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { error: "That store no longer exists." };
    if (store.suspendedAt) return { error: "That store is already suspended." };

    await db
      .update(stores)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));

    await recordPlatformAction({
      session,
      action: "store.suspend",
      targetStoreId: storeId,
      targetLabel: store.name ?? store.shopDomain,
      reason,
    });

    revalidatePlatform(storeId);
    return {
      ok: true,
      message: `${store.name ?? store.shopDomain} suspended. Its webhooks still arrive, so no orders will be lost.`,
    };
  });
}

export async function resumeStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const storeId = String(formData.get("storeId") ?? "");

    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { error: "That store no longer exists." };
    if (!store.suspendedAt) return { error: "That store is not suspended." };

    await db
      .update(stores)
      .set({ suspendedAt: null, suspendedReason: null, updatedAt: new Date() })
      .where(eq(stores.id, storeId));

    await recordPlatformAction({
      session,
      action: "store.resume",
      targetStoreId: storeId,
      targetLabel: store.name ?? store.shopDomain,
    });

    revalidatePlatform(storeId);
    return { ok: true, message: `${store.name ?? store.shopDomain} resumed.` };
  });
}

/**
 * Destroys a store's Shopify access token.
 *
 * The store's orders, stages, branding and history are all kept — this only
 * severs the Shopify connection, exactly as `app/uninstalled` does. The
 * merchant recovers by reinstalling, which mints a fresh token.
 */
export async function disconnectStoreAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const storeId = String(formData.get("storeId") ?? "");
    const reason = reasonOf(formData);
    const confirm = String(formData.get("confirm") ?? "").trim();

    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { error: "That store no longer exists." };

    // Typing the domain is the guard against disconnecting the wrong row from
    // a table of similar-looking stores.
    if (confirm !== store.shopDomain) {
      return {
        fieldErrors: {
          confirm: `Type ${store.shopDomain} exactly to confirm.`,
        },
      };
    }

    await db
      .update(stores)
      .set({
        status: "uninstalled",
        uninstalledAt: new Date(),
        accessToken: null,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));

    await recordPlatformAction({
      session,
      action: "store.disconnect",
      targetStoreId: storeId,
      targetLabel: store.name ?? store.shopDomain,
      reason,
    });

    revalidatePlatform(storeId);
    return {
      ok: true,
      message: `${store.shopDomain} disconnected and its access token destroyed. Its data is kept; reinstalling reconnects it.`,
    };
  });
}

/** An operator-only note on a store. Never shown to the merchant. */
export async function updateStoreNoteAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const storeId = String(formData.get("storeId") ?? "");
    const note = String(formData.get("internalNote") ?? "").trim();

    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { error: "That store no longer exists." };

    await db
      .update(stores)
      .set({ internalNote: note || null, updatedAt: new Date() })
      .where(eq(stores.id, storeId));

    await recordPlatformAction({
      session,
      action: "store.note",
      targetStoreId: storeId,
      targetLabel: store.name ?? store.shopDomain,
      metadata: { length: note.length },
    });

    revalidatePlatform(storeId);
    return { ok: true, message: "Note saved." };
  });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Locks an account out of every store it can reach.
 *
 * Takes effect on the next request, not on token expiry, because
 * `getCurrentUser` re-reads the flag each time.
 */
export async function disableUserAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const userId = String(formData.get("userId") ?? "");
    const reason = reasonOf(formData);

    if (!reason) {
      return { fieldErrors: { reason: "Give a reason for the audit log." } };
    }

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) return { error: "That account no longer exists." };

    // Locking yourself out is the one mistake with no in-app recovery.
    if (target.id === session.user.id) {
      return { error: "You cannot disable your own account." };
    }
    if (target.isPlatformAdmin) {
      return {
        error:
          "Revoke platform access first. Disabling another operator outright is too easy to do by accident.",
      };
    }

    await db
      .update(users)
      .set({ disabledAt: new Date(), disabledReason: reason, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordPlatformAction({
      session,
      action: "user.disable",
      targetUserId: userId,
      targetLabel: target.email,
      reason,
    });

    revalidatePlatform(undefined, userId);
    return { ok: true, message: `${target.email} can no longer sign in.` };
  });
}

export async function enableUserAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const userId = String(formData.get("userId") ?? "");

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) return { error: "That account no longer exists." };
    if (!target.disabledAt) return { error: "That account is not disabled." };

    await db
      .update(users)
      .set({ disabledAt: null, disabledReason: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordPlatformAction({
      session,
      action: "user.enable",
      targetUserId: userId,
      targetLabel: target.email,
    });

    revalidatePlatform(undefined, userId);
    return { ok: true, message: `${target.email} can sign in again.` };
  });
}

/**
 * Grants or revokes platform access.
 *
 * Only an existing operator can do this — a store owner has no route to it —
 * and the platform can never be left with nobody able to administer it.
 */
export async function setPlatformAdminAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const userId = String(formData.get("userId") ?? "");
    const grant = String(formData.get("grant") ?? "") === "true";
    const reason = reasonOf(formData);

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) return { error: "That account no longer exists." };

    if (grant && target.disabledAt) {
      return { error: "Re-enable the account before granting platform access." };
    }
    if (target.isPlatformAdmin === grant) {
      return {
        error: grant
          ? "That account already has platform access."
          : "That account does not have platform access.",
      };
    }

    if (!grant) {
      // Removing your own access is how you end up locked out of the panel
      // with no way back in except a database write.
      if (target.id === session.user.id) {
        return {
          error:
            "You cannot revoke your own platform access. Ask another operator to do it.",
        };
      }

      const [{ value: remaining }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.isPlatformAdmin, true), ne(users.id, userId)));

      if (Number(remaining) === 0) {
        return {
          error:
            "That is the last platform operator. Grant access to someone else first.",
        };
      }
    }

    await db
      .update(users)
      .set({ isPlatformAdmin: grant, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordPlatformAction({
      session,
      action: grant
        ? "user.grant_platform_admin"
        : "user.revoke_platform_admin",
      targetUserId: userId,
      targetLabel: target.email,
      reason,
    });

    revalidatePlatform(undefined, userId);
    return {
      ok: true,
      message: grant
        ? `${target.email} can now open the platform panel.`
        : `Platform access removed from ${target.email}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

/** Removes an account's access to one store. The account itself survives. */
export async function revokeMembershipAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const membershipId = String(formData.get("membershipId") ?? "");

    const [row] = await db
      .select({ membership: storeMemberships, store: stores, user: users })
      .from(storeMemberships)
      .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
      .innerJoin(users, eq(users.id, storeMemberships.userId))
      .where(eq(storeMemberships.id, membershipId))
      .limit(1);

    if (!row) return { error: "That membership no longer exists." };

    // A store with no owner cannot be administered by anyone.
    if (row.membership.role === "owner") {
      const [{ value: owners }] = await db
        .select({ value: count() })
        .from(storeMemberships)
        .where(
          and(
            eq(storeMemberships.storeId, row.store.id),
            eq(storeMemberships.role, "owner"),
            eq(storeMemberships.status, "active"),
            ne(storeMemberships.id, membershipId),
          ),
        );
      if (Number(owners) === 0) {
        return {
          error: `${row.store.shopDomain} would be left with no owner. Add another owner first.`,
        };
      }
    }

    await db
      .update(storeMemberships)
      .set({
        status: "revoked",
        inviteToken: null,
        inviteExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(storeMemberships.id, membershipId));

    await recordPlatformAction({
      session,
      action: "membership.revoke",
      targetStoreId: row.store.id,
      targetUserId: row.user.id,
      targetLabel: `${row.user.email} @ ${row.store.shopDomain}`,
      metadata: { role: row.membership.role },
    });

    revalidatePlatform(row.store.id, row.user.id);
    return {
      ok: true,
      message: `${row.user.email} no longer has access to ${row.store.shopDomain}.`,
    };
  });
}

/** Switches a membership between owner and agency. */
export async function changeMembershipRoleAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const session = await requirePlatformAdmin();
    const membershipId = String(formData.get("membershipId") ?? "");
    const role = String(formData.get("role") ?? "");

    if (role !== "owner" && role !== "agency") {
      return { fieldErrors: { role: "Choose owner or agency." } };
    }

    const [row] = await db
      .select({ membership: storeMemberships, store: stores, user: users })
      .from(storeMemberships)
      .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
      .innerJoin(users, eq(users.id, storeMemberships.userId))
      .where(eq(storeMemberships.id, membershipId))
      .limit(1);

    if (!row) return { error: "That membership no longer exists." };
    if (row.membership.role === role) {
      return { error: `Already ${role}.` };
    }

    // Demoting the last owner leaves the store unadministerable.
    if (row.membership.role === "owner") {
      const [{ value: owners }] = await db
        .select({ value: count() })
        .from(storeMemberships)
        .where(
          and(
            eq(storeMemberships.storeId, row.store.id),
            eq(storeMemberships.role, "owner"),
            eq(storeMemberships.status, "active"),
            ne(storeMemberships.id, membershipId),
          ),
        );
      if (Number(owners) === 0) {
        return {
          error: `${row.store.shopDomain} would be left with no owner.`,
        };
      }
    }

    await db
      .update(storeMemberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(storeMemberships.id, membershipId));

    await recordPlatformAction({
      session,
      action: "membership.role_change",
      targetStoreId: row.store.id,
      targetUserId: row.user.id,
      targetLabel: `${row.user.email} @ ${row.store.shopDomain}`,
      metadata: { from: row.membership.role, to: role },
    });

    revalidatePlatform(row.store.id, row.user.id);
    return {
      ok: true,
      message: `${row.user.email} is now ${role} on ${row.store.shopDomain}.`,
    };
  });
}
