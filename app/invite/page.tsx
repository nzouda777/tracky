import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Card, CardBody } from "@/components/ui";
import { readInvite } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token ? await readInvite(token) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {!invite ? (
          <Card>
            <CardBody className="space-y-4">
              <h1 className="text-lg font-semibold text-ink-900">
                Invitation not valid
              </h1>
              <Alert tone="warning">
                This invitation link has expired or has already been used. Ask
                the store owner to send a new one.
              </Alert>
              <Link href="/login" className="text-sm font-medium text-ink-700 underline">
                Sign in instead
              </Link>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold text-ink-900">
                Join {invite.storeName}
              </h1>
              <p className="text-sm text-ink-500">
                Invited as {invite.role === "owner" ? "an owner" : "delivery agency"} · {invite.email}
              </p>
            </div>
            <Card>
              <CardBody>
                <InviteForm token={token!} hasPassword={invite.hasPassword} />
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
