import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";

import { Alert, Card, CardBody } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { readInstallClaim } from "@/lib/auth/install-claim";
import { db, stores } from "@/lib/db";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Finish setup" };

export default async function ClaimPage() {
  const storeId = await readInstallClaim();

  if (!storeId) {
    return (
      <Shell>
        <Alert tone="warning" title="Setup link expired">
          Re-open Tracky from your Shopify admin to finish connecting your store.
        </Alert>
        <Link href="/login" className="text-sm font-medium text-ink-700 underline">
          Already have an account? Sign in
        </Link>
      </Shell>
    );
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) {
    return (
      <Shell>
        <Alert tone="danger" title="Store not found">
          We could not find that store. Try installing the app again.
        </Alert>
      </Shell>
    );
  }

  const user = await getCurrentUser();

  return (
    <Shell>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-ink-900">
          {store.name ?? store.shopDomain} is connected
        </h1>
        <p className="text-sm text-ink-500">
          {user
            ? "Link your existing account as the owner of this store."
            : "Create the owner account that will manage this store."}
        </p>
      </div>
      <Card>
        <CardBody>
          <ClaimForm
            signedInEmail={user?.email ?? null}
            shopDomain={store.shopDomain}
          />
        </CardBody>
      </Card>
      <p className="text-xs text-ink-500">
        Your store now has its own default tracking stages, email templates and
        branding. You can change all of them from the backoffice.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">{children}</div>
    </main>
  );
}
