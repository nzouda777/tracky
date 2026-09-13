import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";

import { requireStoreAccess } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token issuer for direct browser → Vercel Blob uploads.
 *
 * Two upload kinds are allowed, both authenticated and both scoped to the
 * caller's active store:
 *   - `pod`   — a photo of the PAPER delivery note the customer signed
 *               (agency or owner);
 *   - `logo`  — a store logo for branding (owner only).
 *
 * The client never sees a long-lived Blob token; it gets a single-use one
 * bound to the exact pathname below.
 *
 * Note on privacy: Vercel Blob URLs are public but unguessable. Delivery-note
 * photos can contain a handwritten signature, so the URL is only ever shown
 * inside the authenticated backoffice, never on the customer tracking page.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const kind = pathname.startsWith("logos/") ? "logo" : "pod";
        const session = await requireStoreAccess(
          kind === "logo" ? ["owner"] : ["agency", "owner"],
        );

        // Namespace every object by store so one tenant's files can never
        // collide with — or be overwritten by — another's.
        if (!pathname.startsWith(`${kind === "logo" ? "logos" : "pod"}/${session.store.id}/`)) {
          throw new Error("Upload path is not allowed.");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            storeId: session.store.id,
            userId: session.user.id,
            kind,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // The URL is persisted by the form action that triggered the upload;
        // this hook only exists for observability.
        console.log("[blob] upload completed", blob.pathname, tokenPayload);
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
