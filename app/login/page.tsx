import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, getMemberships } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Send a genuinely signed-in visitor to their home instead of a form they
  // do not need. This check lives here rather than in the middleware because
  // it has to resolve the account: a cookie can be perfectly well signed and
  // still name a user who no longer exists, and bouncing on the signature
  // alone would trap that visitor in a redirect loop. Falling through to the
  // form is the right answer there — signing in replaces the stale cookie.
  const user = await getCurrentUser();
  if (user) {
    const memberships = await getMemberships(user.id);
    if (memberships.length > 0) {
      const ownsAStore = memberships.some(
        (entry) => entry.membership.role === "owner",
      );
      redirect(ownsAStore ? "/admin" : "/agency");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-lg font-semibold tracking-tight text-ink-900">
            Tracky
          </p>
          <h1 className="text-sm text-ink-500">
            Sign in to manage orders and deliveries
          </h1>
        </div>
        <LoginForm next={next} />
        <p className="text-center text-xs text-ink-500">
          Agency accounts are created by invitation from the store owner.
        </p>
      </div>
    </main>
  );
}
