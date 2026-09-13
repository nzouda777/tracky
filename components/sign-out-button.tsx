import { signOut } from "@/auth";
import { clearActiveStore } from "@/lib/auth/session";
import { SubmitButton } from "@/components/ui/submit-button";

/** Server-action sign out, so it works without client-side JavaScript. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      className={className}
      action={async () => {
        "use server";
        await clearActiveStore();
        await signOut({ redirectTo: "/login" });
      }}
    >
      <SubmitButton variant="secondary" size="sm" pendingLabel="Signing out…">
        Sign out
      </SubmitButton>
    </form>
  );
}
