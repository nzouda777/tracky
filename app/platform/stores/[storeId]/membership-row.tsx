"use client";

import Link from "next/link";

import { Badge, Td } from "@/components/ui";
import { PlatformActionForm } from "@/components/platform/action-form";
import {
  changeMembershipRoleAction,
  revokeMembershipAction,
} from "@/lib/actions/platform";
import type { StoreMemberRow } from "@/lib/platform/detail";

/** One person's access to this store, with the two commands that change it. */
export function MembershipRow({ member }: { member: StoreMemberRow }) {
  const nextRole = member.role === "owner" ? "agency" : "owner";

  return (
    <tr className="hover:bg-ink-50">
      <Td>
        <Link
          href={`/platform/users/${member.userId}`}
          className="font-medium text-ink-900 underline-offset-2 hover:underline"
        >
          {member.email}
        </Link>
        {member.name ? (
          <span className="block text-xs text-ink-500">{member.name}</span>
        ) : null}
        <span className="mt-1 flex flex-wrap gap-1">
          {member.isPlatformAdmin ? (
            <Badge tone="info">Platform operator</Badge>
          ) : null}
          {member.disabledAt ? <Badge tone="danger">Account disabled</Badge> : null}
        </span>
      </Td>

      <Td>
        <Badge tone={member.role === "owner" ? "info" : "neutral"}>
          {member.role === "owner" ? "Owner" : "Agency"}
        </Badge>
      </Td>

      <Td>
        {member.status === "active" ? (
          <Badge tone="success">Active</Badge>
        ) : member.status === "invited" ? (
          <Badge tone="warning">Invited</Badge>
        ) : (
          <Badge tone="neutral">Revoked</Badge>
        )}
      </Td>

      <Td>
        {member.status === "revoked" ? (
          <span className="text-xs text-ink-400">No access</span>
        ) : (
          <div className="flex flex-col gap-2">
            <PlatformActionForm
              action={changeMembershipRoleAction}
              label={`Make ${nextRole}`}
              title={`Change role to ${nextRole}?`}
              description={
                nextRole === "owner"
                  ? "They will be able to change branding, stages, templates and settings for this store."
                  : "They will keep dispatch access but lose the backoffice."
              }
              hidden={{ membershipId: member.membershipId, role: nextRole }}
              variant="ghost"
            />
            <PlatformActionForm
              action={revokeMembershipAction}
              label="Remove access"
              title="Remove access to this store?"
              description="Their account survives and keeps any other stores. A store is never left without an owner."
              hidden={{ membershipId: member.membershipId }}
              variant="danger"
            />
          </div>
        )}
      </Td>
    </tr>
  );
}
