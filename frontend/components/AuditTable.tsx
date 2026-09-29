import Link from "next/link";
import { Empty } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { formatDateTime } from "@/lib/format";
import { ACTOR_TYPE_LABELS, AUDIT_ACTION_LABELS } from "@/lib/labels";
import type { AuditEntry } from "@/lib/types";

export default function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <Empty>No entries yet.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Target</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.auditId}>
              <td className="nowrap">{formatDateTime(entry.timestamp)}</td>
              <td>
                {entry.actor}{" "}
                <StatusPill tone={entry.actorType === "human" ? "info" : "neutral"}>
                  {ACTOR_TYPE_LABELS[entry.actorType]}
                </StatusPill>
              </td>
              <td>{AUDIT_ACTION_LABELS[entry.action]}</td>
              <td>
                {entry.targetId.startsWith("inc_") ? (
                  <Link className="link" href={`/claims/${encodeURIComponent(entry.targetId)}`}>
                    {entry.targetId}
                  </Link>
                ) : (
                  entry.targetId
                )}
              </td>
              <td>{entry.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
