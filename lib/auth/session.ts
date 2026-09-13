import { and, eq, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  db,
  stores,
  storeMemberships,
  users,
  type MembershipRole,
  type Store,
  type StoreMembership,
  type User,
} from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";

export const ACTIVE_STORE_COOKIE = "tracky.active_store";

export type Membership = {
  membership: StoreMembership;
  store: Store;
};

export type StoreSession = {
  user: User;
  store: Store;
  membership: StoreMembership;
  role: MembershipRole;
  /** Tenant-scoped data client. Use this for every store-owned table. */
  tdb: TenantDb;
  /** Every store this user may act on, for the store switcher. */
  memberships: Membership[];
};

/** Raised when a signed-in user lacks the role an action requires. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Postgres rejects a malformed uuid outright rather than returning no rows. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signed-in user, or `null`.
 *
 * Contract: this never throws for an unusable session. The id arrives from a
 * signed JWT, but "signed" only means we minted it — it can still name a user
 * that has since been deleted, or carry a value from an older token shape. A
 * non-uuid would make Postgres raise `invalid input syntax for type uuid`,
 * turning "not signed in" into a 500, so the shape is checked before the query
 * rather than after the crash.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !UUID.test(userId)) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  // A disabled account is checked here rather than only at sign-in, so
  // revoking access takes effect on the very next request instead of whenever
  // the already-issued JWT happens to expire — which could be two weeks.
  if (user.disabledAt) return null;

  return user;
}

/** Active, non-revoked memberships for a user, with their stores attached. */
export async function getMemberships(userId: string): Promise<Membership[]> {
  const rows = await db
    .select({ membership: storeMemberships, store: stores })
    .from(storeMemberships)
    .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
    .where(
      and(
        eq(storeMemberships.userId, userId),
        eq(storeMemberships.status, "active"),
        eq(stores.status, "active"),
        // A store suspended by a platform operator drops out of every
        // membership list, so its backoffice and dispatch screens simply
        // cannot be reached. Its webhooks keep arriving, so no orders are
        // lost while it is held.
        isNull(stores.suspendedAt),
      ),
    );

  return rows.sort((a, b) =>
    (a.store.name ?? a.store.shopDomain).localeCompare(
      b.store.name ?? b.store.shopDomain,
    ),
  );
}

/** Persists the store switcher choice. */
export async function setActiveStore(storeId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearActiveStore(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTIVE_STORE_COOKIE);
}

/** Redirects to the sign-in page unless a user is signed in. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The central server-side authorisation check.
 *
 * Resolves the signed-in user, the store they are currently acting on and the
 * role they hold *in that store*, then verifies the role is allowed. Every
 * page, route handler and server action that touches store data must start
 * here — the UI hiding a button is never the control.
 */
export async function requireStoreAccess(
  allowedRoles: MembershipRole[] = ["owner", "agency"],
  options: { redirectOnForbidden?: string } = {},
): Promise<StoreSession> {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);

  if (memberships.length === 0) {
    redirect("/no-access");
  }

  const jar = await cookies();
  const requested = jar.get(ACTIVE_STORE_COOKIE)?.value;

  // An active-store cookie is only ever honoured if the user really is a
  // member of that store, so a tampered cookie cannot cross a tenant boundary.
  const eligible = memberships.filter((entry) =>
    allowedRoles.includes(entry.membership.role),
  );
  if (eligible.length === 0) {
    if (options.redirectOnForbidden) redirect(options.redirectOnForbidden);
    throw new ForbiddenError(
      "Your role in this store does not allow access to this area.",
    );
  }

  const selected =
    eligible.find((entry) => entry.store.id === requested) ?? eligible[0];

  return {
    user,
    store: selected.store,
    membership: selected.membership,
    role: selected.membership.role,
    tdb: new TenantDb(selected.store.id),
    memberships,
  };
}

/**
 * Store owner / admin only. An agency-only user is sent to their own area
 * rather than shown an error, since that is where they belong.
 */
export function requireOwner(): Promise<StoreSession> {
  return requireStoreAccess(["owner"], { redirectOnForbidden: "/agency" });
}

/**
 * Agency dispatch area. Owners are allowed in too, so an admin can verify what
 * the agency sees without a second account.
 */
export function requireAgency(): Promise<StoreSession> {
  return requireStoreAccess(["agency", "owner"]);
}

/**
 * Asserts access to one specific store, regardless of the active-store cookie.
 * Used by actions that carry a store id in their payload.
 */
export async function requireStoreById(
  storeId: string,
  allowedRoles: MembershipRole[] = ["owner", "agency"],
): Promise<StoreSession> {
  const user = await requireUser();
  const rows = await db
    .select({ membership: storeMemberships, store: stores })
    .from(storeMemberships)
    .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
    .where(
      and(
        eq(storeMemberships.userId, user.id),
        eq(storeMemberships.storeId, storeId),
        eq(storeMemberships.status, "active"),
        inArray(storeMemberships.role, allowedRoles),
        // Same two conditions as getMemberships: an uninstalled or suspended
        // store is unreachable however the caller arrives at it.
        eq(stores.status, "active"),
        isNull(stores.suspendedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ForbiddenError("You do not have access to this store.");
  }

  return {
    user,
    store: row.store,
    membership: row.membership,
    role: row.membership.role,
    tdb: new TenantDb(row.store.id),
    memberships: await getMemberships(user.id),
  };
}
