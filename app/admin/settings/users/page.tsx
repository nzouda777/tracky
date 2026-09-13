import type { Metadata } from "next";
import { eq } from "drizzle-orm";

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
import { requireOwner } from "@/lib/auth/session";
import { db, storeMemberships, users } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { InviteUserForm } from "./invite-user-form";
import { RevokeButton } from "./revoke-button";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const { store, user: currentUser } = await requireOwner();

  const members = await db
    .select({ membership: storeMemberships, user: users })
    .from(storeMemberships)
    .innerJoin(users, eq(users.id, storeMemberships.userId))
    .where(eq(storeMemberships.storeId, store.id));

  const sorted = members.sort((a, b) =>
    a.user.email.localeCompare(b.user.email),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Who can access this store, and what they may do."
      />

      <Alert tone="info" title="Drivers do not have accounts">
        Drivers deliver and collect a signature on paper. They are recorded as a
        name against an order, nothing more. Only the delivery agency records
        updates in this app.
      </Alert>

      <Card>
        <CardHeader title="Members" />
        {sorted.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">No members yet.</p>
          </CardBody>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Since</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ membership, user }) => (
                <tr key={membership.id}>
                  <Td>{user.email}</Td>
                  <Td className="text-ink-600">{user.name ?? "—"}</Td>
                  <Td>
                    <Badge tone={membership.role === "owner" ? "info" : "neutral"}>
                      {membership.role === "owner" ? "Owner" : "Agency"}
                    </Badge>
                  </Td>
                  <Td>
                    {membership.status === "active" ? (
                      <Badge tone="success">Active</Badge>
                    ) : membership.status === "invited" ? (
                      <Badge tone="warning">Invited</Badge>
                    ) : (
                      <Badge tone="danger">Revoked</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">
                    {formatDate(membership.acceptedAt ?? membership.createdAt)}
                  </Td>
                  <Td>
                    {membership.status !== "revoked" &&
                    membership.userId !== currentUser.id ? (
                      <RevokeButton
                        membershipId={membership.id}
                        email={user.email}
                      />
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Invite someone"
          description="They receive a one-time link and set their own password."
        />
        <CardBody>
          {!env.resend.configured ? (
            <Alert tone="warning" className="mb-4">
              Email is not configured, so the invitation link will be shown here
              for you to share manually.
            </Alert>
          ) : null}
          <InviteUserForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What each role can do" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            <strong>Owner</strong> — everything: branding, stages, email
            templates and sequences, fulfillment rules, orders, users, manual
            stage overrides.
          </p>
          <p>
            <strong>Agency</strong> — the dispatch area only: see active orders,
            assign a driver, update an order&rsquo;s stage, and confirm a
            delivery. No access to branding, templates or settings.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
