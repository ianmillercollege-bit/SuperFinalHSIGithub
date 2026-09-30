"use client";

import { useCallback, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import SampleNote from "@/components/screens/CommunitySampleNote";
import StatusPill from "@/components/StatusPill";
import { Toast, useToast } from "@/components/Toast";
import { decideCommunityRequest, getCommunityRequests } from "@/lib/api";
import { canAct, useUserSession } from "@/lib/auth/userSession";
import { describeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { CommunityRequest, CommunityRequestStatus } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const STATUS: Record<CommunityRequestStatus, { label: string; tone: "warn" | "good" | "neutral" }> = {
  pending_approval: { label: "Waiting for approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "neutral" },
};

/**
 * Community requests = GET /community/requests (contract v1.6, section 7e). A partner sees its own requests, a company
 * sees the requests for its products and its Brand Data Owner approves or rejects them, staff see all (read only).
 */
export default function CommunityRequests() {
  const session = useUserSession();
  const { user } = session;
  const [status, setStatus] = useState("");
  const requests = useApi(useCallback(() => getCommunityRequests((status || undefined) as CommunityRequestStatus | undefined), [status]));
  const { toast, show, hide } = useToast();
  const canDecide = canAct(session) && !user?.partner && !user?.staff;
  const rows = requests.data?.data.requests ?? [];

  return (
    <div className="stack">
      <section className="card stack">
        <div className="filters">
          <div className="grow">
            <h2>
              {user?.partner ? "Your requests" : "Requests for your units"}
              {requests.data && <span className="count">{rows.length}</span>}
            </h2>
            <p className="muted small">
              {user?.partner
                ? "Each request waits for a named owner at the company to approve or reject it."
                : "A Brand Data Owner approves or rejects each request. CIRQO never checks anyone's income or need; the partner does."}
            </p>
          </div>
          <Dropdown
            label="Status"
            compact
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "All requests" }, ...(Object.keys(STATUS) as CommunityRequestStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))]}
          />
        </div>
        {requests.data?.sample && <SampleNote />}
        {requests.loading && <Loading what="requests" />}
        {requests.error !== undefined && <ErrorNotice error={requests.error} onRetry={requests.reload} />}
        {requests.data && rows.length === 0 && <Empty>No requests yet.</Empty>}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Organization</th>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  {canDecide && <th>Decision</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.requestId} request={r} canDecide={canDecide} onDone={(message, kind) => { show(message, kind); requests.reload(); }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Toast toast={toast} onClose={hide} />
    </div>
  );
}

function Row({ request: r, canDecide, onDone }: { request: CommunityRequest; canDecide: boolean; onDone: (message: string, kind: "ok" | "error") => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const open = r.status === "pending_approval";

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      await decideCommunityRequest(r.requestId, decision, note.trim());
      onDone(`${decision === "approve" ? "Approved" : "Rejected"}: ${r.units} units for ${r.partner.orgName}.`, "ok");
    } catch (e) {
      onDone(describeError(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td className="nowrap">{formatDateTime(r.createdAt)}</td>
      <td>{r.partner.orgName}</td>
      <td className="nowrap">{r.productId}</td>
      <td>{r.units}</td>
      <td>{r.purpose}</td>
      <td>
        <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>
      </td>
      {canDecide && (
        <td>
          {open ? (
            <div className="stack-tight">
              <input aria-label={`Note for request ${r.requestId} (optional)`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="button-row">
                <button type="button" className="button" disabled={busy} onClick={() => void decide("approve")}>
                  Approve
                </button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => void decide("reject")}>
                  Reject
                </button>
              </div>
            </div>
          ) : (
            "Decided"
          )}
        </td>
      )}
    </tr>
  );
}
