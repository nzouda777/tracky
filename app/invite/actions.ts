"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser, setActiveStore } from "@/lib/auth/session";
import { db, storeMemberships, stores, users } from "@/lib/db";

export type InviteState = { error?: string };

export type InviteDetails = {
  storeName: string;
  email: string;
  role: "owner" | "agency";
  hasPassword: boolean;
};

/** Resolves a live invite token, or null when it is unknown or expired. */
export async function readInvite(token: string): Promise<InviteDetails | null> {
  if (!token) return null;

  const [row] = await db
    .select({ membership: storeMemberships, store: stores, user: users })
    .from(storeMemberships)
    .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
    .innerJoin(users, eq(users.id, storeMemberships.userId))
    .where(
      and(
        eq(storeMemberships.inviteToken, token),
        eq(storeMemberships.status, "invited"),
        gt(storeMemberships.inviteExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    storeName: row.store.name ?? row.store.shopDomain,
    email: row.user.email,
    role: row.membership.role,
    hasPassword: Boolean(row.user.passwordHash),
  };
}

/**
 * Accepts an invitation: verifies the token, sets a password for a brand-new
 * account (or checks the existing one), activates the membership and burns the
 * token so the link cannot be reused.
 */
export async function acceptInviteAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const [row] = await db
    .select({ membership: storeMemberships, user: users })
    .from(storeMemberships)
    .innerJoin(users, eq(users.id, storeMemberships.userId))
    .where(
      and(
        eq(storeMemberships.inviteToken, token),
        eq(storeMemberships.status, "invited"),
        gt(storeMemberships.inviteExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return { error: "This invitation is no longer valid. Ask for a new one." };
  }

  const { membership, user } = row;
  let credentials: { email: string; password: string } | null = null;

  if (user.passwordHash) {
    // Existing account: confirm it really is them before granting access.
    const signedIn = await getCurrentUser();
    const isSameUser = signedIn?.id === user.id;

    if (!isSameUser) {
      if (!password) {
        return { error: "Enter your existing Tracky password to accept." };
      }
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return { error: "Incorrect password." };
      credentials = { email: user.email, password };
    }
  } else {
    if (!password) return { error: "Choose a password." };
    if (password !== confirm) return { error: "The two passwords do not match." };

    const problems = validatePassword(password);
    if (problems.length > 0) return { error: problems.join(" ") };

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    credentials = { email: user.email, password };
  }

  await db
    .update(storeMemberships)
    .set({
      status: "active",
      acceptedAt: new Date(),
      // Burn the token: an invite link works exactly once.
      inviteToken: null,
      inviteExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(storeMemberships.id, membership.id));

  await setActiveStore(membership.storeId);

  if (credentials) {
    await signIn("credentials", { ...credentials, redirect: false });
  }

  redirect(membership.role === "owner" ? "/admin" : "/agency");
}
