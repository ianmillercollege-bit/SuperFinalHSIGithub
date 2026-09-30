"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import SampleNote from "@/components/screens/CommunitySampleNote";
import StatusPill from "@/components/StatusPill";
import { Toast, useToast } from "@/components/Toast";
import { createCommunityRequest, getCommunityCatalog } from "@/lib/api";
import { useUserSession } from "@/lib/auth/userSession";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/lib/categories";
import { describeError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import type { CommunityItem, ProductCondition } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "surplus", label: "Surplus" },
];
const conditionLabel = (c: string) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

/**
 * Community catalog = GET /community/catalog (contract v1.6, section 7e): units companies have pledged, with the same
 * verified facts as everything else. Community Partners request units; a named owner at the company approves.
 */
export default function CommunityCatalog() {
  const { user } = useUserSession();
  const allowed = Boolean(user?.partner || user?.staff);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const catalog = useApi(
    useCallback(
      () => (allowed ? getCommunityCatalog({ category: (category || undefined) as never, condition: (condition || undefined) as ProductCondition | undefined }) : Promise.resolve(null)),
      [allowed, category, condition],
    ),
  );
  const [requesting, setRequesting] = useState<CommunityItem | null>(null);
  const { toast, show, hide } = useToast();

  if (!allowed) {
    return (
      <section className="card stack">
        <h2>The Community catalog is for Community Partners</h2>
        <p className="muted">Sign in with a Community Partner login to browse pledged units and request them.</p>
        <Link className="button" href="/login">
          Go to sign in
        </Link>
      </section>
    );
  }

  const items = catalog.data?.data.items ?? [];
  return (
    <div className="stack">
      <section className="card stack">
        <div className="filters">
          <div className="grow">
            <h2>
              Pledged units
              {catalog.data && <span className="count">{items.length}</span>}
            </h2>
            <p className="muted small">
              Companies pledge surplus and refurbished units. CIRQO checks the facts, never a person&apos;s income or need: partners do that under their own rules.
            </p>
          </div>
          <Dropdown label="Category" compact value={category} onChange={setCategory} options={[{ value: "", label: "All categories" }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]} />
          <Dropdown label="Condition" compact value={condition} onChange={setCondition} options={[{ value: "", label: "Any condition" }, ...CONDITIONS]} />
        </div>
        {catalog.data?.sample && <SampleNote />}
        {catalog.loading && <Loading what="the Community catalog" />}
        {catalog.error !== undefined && <ErrorNotice error={catalog.error} onRetry={catalog.reload} />}
        {catalog.data && items.length === 0 && <Empty>No pledged units match these filters yet.</Empty>}
        {items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Company</th>
                  <th>Condition</th>
                  <th>Price</th>
                  <th>Available</th>
                  <th>Warranty</th>
                  <th>Facts</th>
                  {user?.partner && <th>Request</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const left = i.communityPledge.unitsPledged - i.communityPledge.unitsPlaced;
                  return (
                    <tr key={i.productId}>
                      <td>
                        {i.name}
                        <span className="muted small block">{categoryLabel(i.category)}</span>
                      </td>
                      <td>{i.brandName}</td>
                      <td>
                        {conditionLabel(i.condition)}
                        <span className="muted small block">{i.communityPledge.conditionNotes}</span>
                      </td>
                      <td className="nowrap">{formatPrice(i.price)}</td>
                      <td className="nowrap">
                        {left} of {i.communityPledge.unitsPledged}
                      </td>
                      <td className="nowrap">{i.communityPledge.warrantyMonths} months</td>
                      <td>
                        <StatusPill tone={i.verified ? "good" : "warn"}>{i.verified ? "Verified by brand" : "Not verified by the brand"}</StatusPill>
                        <ul className="small plain-list">
                          {i.facts.map((f) => (
                            <li key={f.factId}>{f.text}</li>
                          ))}
                        </ul>
                      </td>
                      {user?.partner && (
                        <td>
                          <button type="button" className="button" disabled={left < 1} onClick={() => setRequesting(i)}>
                            {left < 1 ? "None left" : "Request units"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {requesting && (
        <RequestForm
          key={requesting.productId}
          item={requesting}
          onCancel={() => setRequesting(null)}
          onSent={(message) => {
            setRequesting(null);
            show(message);
            catalog.reload();
          }}
        />
      )}
      <Toast toast={toast} onClose={hide} />
    </div>
  );
}

function RequestForm({ item, onCancel, onSent }: { item: CommunityItem; onCancel: () => void; onSent: (message: string) => void }) {
  const left = item.communityPledge.unitsPledged - item.communityPledge.unitsPlaced;
  const [units, setUnits] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const count = useMemo(() => Number(units), [units]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isInteger(count) || count < 1 || count > left) return setError(`Ask for a whole number of units from 1 to ${left}.`);
    if (!purpose.trim()) return setError("Say what the units are for.");
    setError(undefined);
    setSending(true);
    try {
      const made = await createCommunityRequest({ productId: item.productId, units: count, purpose: purpose.trim() });
      onSent(`Request sent to ${item.brandName}. A named owner there will approve or decline it. Request ${made.data.requestId}.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card stack" onSubmit={(e) => void submit(e)} noValidate aria-label={`Request ${item.name}`}>
      <h2>Request {item.name}</h2>
      <p className="muted small">From {item.brandName}. {left} units are available.</p>
      <label className="field">
        Units
        <input type="number" inputMode="numeric" min={1} max={left} value={units} onChange={(e) => setUnits(e.target.value)} required />
      </label>
      <label className="field">
        What are the units for?
        <textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Laptops for 10 students in the fall cohort" required />
      </label>
      <p className="muted small">Don&apos;t enter names or personal details of the people who will receive the units. CIRQO stores none.</p>
      {error && (
        <p className="state-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="button" disabled={sending}>
          {sending ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="button button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
