import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { AuditTable } from "@/components/platform/audit-table";
import { PlatformActionForm } from "@/components/platform/action-form";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  disableUserAction,
  enableUserAction,
  revokeMembershipAction,
  setPlatformAdminAction,
} from "@/lib/actions/platform";
import { listPlatformAudit } from "@/lib/platform/audit";
import { getPlatformUserDetail } from "@/lib/platform/detail";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

export default async function PlatformUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { userId } = await params;

  const detail = await getPlatformUserDetail(userId);
  if (!detail) notFound();

  const { user, memberships } = detail;
  const audit = await listPlatformAudit({ userId, limit: 25 });
  const isSelf = user.id === session.user.id;
  const active = memberships.filter((row) => row.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.email}
        description={user.name ?? "No name on the account"}
        action={
          <Link
            href="/platform/users"
            className="text-sm font-medium text-ink-600 underline underline-offset-2"
          >
            ← All accounts
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {user.isPlatformAdmin ? (
          <Badge tone="info">Platform operator</Badge>
        ) : (
          <Badge tone="neutral">Store user</Badge>
        )}
        {user.disabledAt ? (
          <Badge tone="danger">Disabled</Badge>
        ) : user.hasPassword ? (
          <Badge tone="success">Can sign in</Badge>
        ) : (
          <Badge tone="warning">Invite pending</Badge>
        )}
        {isSelf ? <Badge tone="neutral">This is you</Badge> : null}
      </div>

      {user.disabledAt ? (
        <Alert tone="danger" title="This account is disabled">
          Disabled {formatDateTime(user.disabledAt)}
          {user.disabledReason ? ` — ${user.disabledReason}` : ""}. It cannot
          sign in, and any session it still holds stops working on its next
          request.
        </Alert>
      ) : null}

      {!user.hasPassword ? (
        <Alert tone="info" title="No password set">
          This account was created by an invitation that has not been accepted
          yet. It cannot sign in until the invitee follows their link and
          chooses a password.
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <dl className="space-y-2.5 text-sm">
              <Row label="Email" value={user.email} />
              <Row label="Name" value={user.name ?? "—"} />
              <Row label="Created" value={formatDate(user.createdAt)} />
              <Row label="Password set" value={user.hasPassword ? "Yes" : "No"} />
              <Row label="Stores" value={String(active.length)} />
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Password hashes never leave the database layer — this panel only
              knows whether one exists. To let someone back in, have them use
              the sign-in form, or issue a fresh invitation from their
              store&rsquo;s Users screen.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Operator actions"
            description="Recorded in the audit log with your name and reason."
          />
          <CardBody className="space-y-3">
            {user.disabledAt ? (
              <PlatformActionForm
                action={enableUserAction}
                label="Re-enable account"
                title="Re-enable this account?"
                description="They will be able to sign in again, with the access they had before."
                hidden={{ userId: user.id }}
                variant="primary"
              />
            ) : (
              <PlatformActionForm
                action={disableUserAction}
                label="Disable account"
                title={`Disable ${user.email}?`}
                description="They lose access to every store immediately — on the next request, not when their session expires."
                hidden={{ userId: user.id }}
                variant="danger"
                requireReason
                disabled={isSelf || user.isPlatformAdmin}
              />
            )}

            {user.isPlatformAdmin ? (
              <PlatformActionForm
                action={setPlatformAdminAction}
                label="Revoke platform access"
                title="Revoke platform access?"
                description="They keep their store memberships, but lose the cross-store panel."
                hidden={{ userId: user.id, grant: "false" }}
                variant="secondary"
                requireReason
                disabled={isSelf}
              />
            ) : (
              <PlatformActionForm
                action={setPlatformAdminAction}
                label="Grant platform access"
                title={`Give ${user.email} platform access?`}
                description="They will see and be able to manage every store on the platform, including suspending them and changing other people's access."
                hidden={{ userId: user.id, grant: "true" }}
                variant="secondary"
                requireReason
                confirmPhrase={user.email}
                confirmLabel="Type the address"
                disabled={Boolean(user.disabledAt)}
              />
            )}

            {isSelf ? (
              <p className="text-xs text-ink-500">
                Disabling your own account, or revoking your own platform
                access, is blocked — it is the one mistake with no way back
                except a database write.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Store access"
          description="Which stores this account can reach, and as what."
        />
        {memberships.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">
              This account is not a member of any store.
            </p>
          </CardBody>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((row) => (
                <tr key={row.membershipId} className="hover:bg-ink-50">
                  <Td>
                    <Link
                      href={`/platform/stores/${row.storeId}`}
                      className="font-medium text-ink-900 underline-offset-2 hover:underline"
                    >
                      {row.storeName ?? row.shopDomain}
                    </Link>
                    <span className="block text-xs text-ink-500">
                      {row.shopDomain}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={row.role === "owner" ? "info" : "neutral"}>
                      {row.role === "owner" ? "Owner" : "Agency"}
                    </Badge>
                  </Td>
                  <Td>
                    {row.status === "active" ? (
                      <Badge tone="success">Active</Badge>
                    ) : row.status === "invited" ? (
                      <Badge tone="warning">Invited</Badge>
                    ) : (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </Td>
                  <Td>
                    {row.status === "revoked" ? (
                      <span className="text-xs text-ink-400">No access</span>
                    ) : (
                      <PlatformActionForm
                        action={revokeMembershipAction}
                        label="Remove access"
                        title={`Remove access to ${row.shopDomain}?`}
                        description="The account survives and keeps its other stores. A store is never left without an owner."
                        hidden={{ membershipId: row.membershipId }}
                        variant="danger"
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Operator history for this account" />
        <AuditTable
          entries={audit}
          emptyHint="No operator has acted on this account."
        />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="break-all text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}
