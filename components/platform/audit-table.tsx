import Link from "next/link";

import { Badge, EmptyState, TableWrap, Td, Th } from "@/components/ui";
import { ACTION_LABELS, DESTRUCTIVE_ACTIONS } from "@/lib/platform/audit";
import type { PlatformAuditEntry } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/utils";

/**
 * The operator action log.
 *
 * Rows are append-only and carry the actor's email and a target label frozen
 * at write time, so an entry still reads correctly after the store or account
 * it refers to has gone.
 */
export function AuditTable({
  entries,
  emptyHint,
}: {
  entries: PlatformAuditEntry[];
  emptyHint?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No operator actions recorded"
        description={
          emptyHint ??
          "Every suspension, disconnection and permission change appears here."
        }
      />
    );
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Action</Th>
          <Th>Target</Th>
          <Th>Operator</Th>
          <Th>Reason</Th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="hover:bg-ink-50">
            <Td className="whitespace-nowrap">
              <time
                dateTime={entry.createdAt.toISOString()}
                title={formatDateTime(entry.createdAt)}
                className="text-ink-700"
              >
                {formatRelative(entry.createdAt)}
              </time>
            </Td>
            <Td>
              <Badge tone={DESTRUCTIVE_ACTIONS.has(entry.action) ? "warning" : "neutral"}>
                {ACTION_LABELS[entry.action]}
              </Badge>
            </Td>
            <Td>
              {entry.targetStoreId ? (
                <Link
                  href={`/platform/stores/${entry.targetStoreId}`}
                  className="text-ink-900 underline-offset-2 hover:underline"
                >
                  {entry.targetLabel}
                </Link>
              ) : entry.targetUserId ? (
                <Link
                  href={`/platform/users/${entry.targetUserId}`}
                  className="text-ink-900 underline-offset-2 hover:underline"
                >
                  {entry.targetLabel}
                </Link>
              ) : (
                <span className="text-ink-700">{entry.targetLabel}</span>
              )}
              {entry.metadata ? (
                <span className="ml-2 text-xs text-ink-400">
                  {describeMetadata(entry.metadata)}
                </span>
              ) : null}
            </Td>
            <Td className="text-ink-600">{entry.actorEmail}</Td>
            <Td className="max-w-72 text-ink-600">{entry.reason ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function describeMetadata(metadata: Record<string, unknown>): string {
  if (typeof metadata.from === "string" && typeof metadata.to === "string") {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (typeof metadata.role === "string") return `was ${metadata.role}`;
  return "";
}
