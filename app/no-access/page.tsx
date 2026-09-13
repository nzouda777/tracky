import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Card, CardBody } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "No store access" };

export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <h1 className="text-lg font-semibold text-ink-900">
              No store access yet
            </h1>
            <Alert tone="info">
              Your account is not linked to any store. Ask the store owner to
              invite you, or install the app on your Shopify store to get
              started.
            </Alert>
            <div className="flex flex-wrap items-center gap-3">
              <SignOutButton />
              <Link
                href="/"
                className="text-sm font-medium text-ink-600 underline"
              >
                Back to start
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
