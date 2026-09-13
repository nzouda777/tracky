import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getPlatformUsers } from "@/lib/platform/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform accounts" };

export default async function PlatformUsersPage() {
  const session = await requirePlatformAdmin();
  const rows = await getPlatformUsers();

  const operators = rows.filter((row) => row.isPlatformAdmin).length;
  const disabled = rows.filter((row) => row.disabledAt).length;
  const pending = rows.filter((row) => !row.hasPassword).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description={`${rows.length} account${rows.length === 1 ? "" : "s"} · ${operators} operator${operators === 1 ? "" : "s"}${disabled > 0 ? ` · ${disabled} disabled` : ""}${pending > 0 ? ` · ${pending} invite pending` : ""}.`}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No accounts yet" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Stores</Th>
                <Th>Sign-in</Th>
                <Th>Role</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-ink-50">
                  <Td>
                    <Link
                      href={`/platform/users/${row.id}`}
                      className="font-medium text-ink-900 underline-offset-2 hover:underline"
                    >
                      {row.email}
                    </Link>
                    {row.id === session.user.id ? (
                      <span className="ml-2 text-xs text-ink-400">(you)</span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-600">{row.name ?? "—"}</Td>
                  <Td className="tabular-nums text-ink-700">{row.storeCount}</Td>
                  <Td>
                    {row.disabledAt ? (
                      <Badge tone="danger">Disabled</Badge>
                    ) : row.hasPassword ? (
                      <Badge tone="success">Enabled</Badge>
                    ) : (
                      <Badge tone="warning">Invite pending</Badge>
                    )}
                  </Td>
                  <Td>
                    {row.isPlatformAdmin ? (
                      <Badge tone="info">Platform operator</Badge>
                    ) : (
                      <Badge tone="neutral">Store user</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">
                    {formatDate(row.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="How access works" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            <strong>Store users</strong> are created by a merchant inviting
            them, or by claiming a store after installing the app. Open an
            account to change its roles, remove a store, disable it or grant
            platform access.
          </p>
          <p>
            <strong>Platform operators</strong> see and manage every store.
            Only an existing operator can grant it — a store owner has no route
            to it — and the platform refuses to leave itself with no operator
            at all, or a store with no owner.
          </p>
          <p>
            Your own access came from the <strong>{session.grantedBy}</strong>.
            Operators listed in <code>PLATFORM_ADMIN_EMAILS</code> keep access
            regardless of the database flag, so that is the way back in if the
            last operator is ever removed.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
