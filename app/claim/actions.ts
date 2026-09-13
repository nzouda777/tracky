"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import {
  clearInstallClaim,
  readInstallClaim,
} from "@/lib/auth/install-claim";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { getCurrentUser, setActiveStore } from "@/lib/auth/session";
import { db, storeMemberships, stores, users } from "@/lib/db";

export type ClaimState = { error?: string };

/**
 * Creates (or links) the owner account for a store that was just installed.
 *
 * Authorisation comes from the signed install-claim cookie, which is only
 * issued to a browser that completed Shopify OAuth for this exact shop — i.e.
 * to someone with admin rights on that Shopify store.
 */
export async function claimStoreAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const storeId = await readInstallClaim();
  if (!storeId) {
    return {
      error:
        "This setup link has expired. Re-open the app from your Shopify admin to start again.",
    };
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) {
    return { error: "That store could not be found." };
  }

  // An owner already exists: this claim must not hand over a second ownership.
  const [existingOwner] = await db
    .select({ id: storeMemberships.id })
    .from(storeMemberships)
    .where(
      and(
        eq(storeMemberships.storeId, storeId),
        eq(storeMemberships.role, "owner"),
        eq(storeMemberships.status, "active"),
      ),
    )
    .limit(1);

  const signedInUser = await getCurrentUser();

  if (existingOwner && !signedInUser) {
    return {
      error:
        "This store already has an owner. Sign in with the owner account instead.",
    };
  }

  let userId: string;
  let credentials: { email: string; password: string } | null = null;

  if (signedInUser) {
    // Linking the currently signed-in account as owner of the new store.
    userId = signedInUser.id;
  } else {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (!email || !password) {
      return { error: "Enter an email address and a password." };
    }
    if (password !== confirm) {
      return { error: "The two passwords do not match." };
    }
    const problems = validatePassword(password);
    if (problems.length > 0) {
      return { error: problems.join(" ") };
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return {
        error:
          "An account with that email already exists. Sign in first, then re-open the app from Shopify to link this store.",
      };
    }

    const [created] = await db
      .insert(users)
      .values({
        email,
        name: name || null,
        passwordHash: await hashPassword(password),
      })
      .returning();

    userId = created.id;
    credentials = { email, password };
  }

  await db
    .insert(storeMemberships)
    .values({
      storeId,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [storeMemberships.storeId, storeMemberships.userId],
      set: { role: "owner", status: "active", updatedAt: new Date() },
    });

  await clearInstallClaim();
  await setActiveStore(storeId);

  if (credentials) {
    await signIn("credentials", { ...credentials, redirect: false });
  }

  redirect("/admin");
}
