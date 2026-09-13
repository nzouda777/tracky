"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";

export type LoginState = { error?: string };

/**
 * Signs a user in with email + password.
 *
 * `redirect: false` keeps the failure path on this page so we can render an
 * error, then we redirect manually on success.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email address or password." };
    }
    throw error;
  }

  // Only allow same-site destinations, so `?next=` cannot be used as an open
  // redirect to another host.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  redirect(destination);
}
