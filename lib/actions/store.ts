"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getMemberships,
  requireUser,
  setActiveStore,
} from "@/lib/auth/session";

/**
 * Switches the store the user is acting on.
 *
 * The requested id is checked against the user's own memberships before the
 * cookie is written, so the switcher can never be used to reach a store the
 * user is not a member of.
 */
export async function switchStoreAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");

  const user = await requireUser();
  const memberships = await getMemberships(user.id);
  const target = memberships.find((entry) => entry.store.id === storeId);

  if (!target) {
    // Silently stay put: nothing to switch to.
    redirect(returnTo.startsWith("/") ? returnTo : "/admin");
  }

  await setActiveStore(target.store.id);
  revalidatePath("/", "layout");
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin");
}
