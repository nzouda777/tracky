import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Card, CardBody } from "@/components/ui";

export const metadata: Metadata = { title: "Installation failed" };

export default async function InstallFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <h1 className="text-lg font-semibold text-ink-900">
              We could not complete the installation
            </h1>
            <Alert tone="danger">
              {message ?? "Something went wrong while connecting your store."}
            </Alert>
            <p className="text-sm text-ink-500">
              Open the app again from your Shopify admin to retry. If it keeps
              failing, check that the app URL and redirect URL in your Shopify
              app settings match this deployment.
            </p>
            <Link href="/login" className="text-sm font-medium text-ink-700 underline">
              Sign in instead
            </Link>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
