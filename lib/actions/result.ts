import { ForbiddenError } from "@/lib/auth/session";

/** Uniform shape every server action returns, so forms can render feedback. */
export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Per-field errors, keyed by input name. */
  fieldErrors?: Record<string, string>;
};

/**
 * Wraps an action body so expected failures become a rendered message instead
 * of an error page, while `redirect()` and genuine bugs keep propagating.
 */
export async function guard(
  run: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    // Next implements redirect()/notFound() by throwing; let those through.
    if (isFrameworkError(error)) throw error;

    if (error instanceof ForbiddenError) {
      return { error: error.message };
    }
    console.error("[action] unexpected failure", error);
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}

function isFrameworkError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}
