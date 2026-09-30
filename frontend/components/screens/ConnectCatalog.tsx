"use client";

import { useState } from "react";
import Dropdown from "@/components/Dropdown";
import { ErrorNotice } from "@/components/LoadState";
import { ApiError, onboardBrand } from "@/lib/api";
import { signInAs } from "@/lib/auth/brandSession";
import { AVAILABILITY_VALUES, emptyRow, parseCatalogCsv, parseCatalogXlsx } from "@/lib/catalogCsv";
import type { CatalogRow } from "@/lib/catalogCsv";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import type { OnboardProduct, OnboardRequest, OnboardResponse } from "@/lib/types";

const MAX_FILE_BYTES = 25_000_000;
const PAGE_SIZE = 100; // rows shown at once; every row is still sent

const isExcel = (file: File) => /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");

/** Turns the text in a table row into the contract's product, or explains what is wrong with it. */
function toProduct(row: CatalogRow, number: number): { product?: OnboardProduct; problem?: string } {
  const name = row.name.trim();
  if (!name) return { problem: `Product ${number}: enter a name.` };
  const price = Number(row.price);
  if (row.price.trim() === "" || !Number.isFinite(price) || price <= 0) return { problem: `Product ${number}: price must be a number above 0.` };
  const optional = (text: string, label: string): { value?: number; problem?: string } => {
    if (text.trim() === "") return {};
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? { value: n } : { problem: `Product ${number}: ${label} must be a number.` };
  };
  const battery = optional(row.batteryHours, "battery hours");
  const weight = optional(row.weightLb, "weight");
  const screen = optional(row.screenInches, "screen size");
  const returns = optional(row.returnPolicyDays, "return days");
  const ram = optional(row.ramGb, "RAM");
  const storage = optional(row.storageGb, "storage");
  const problem = battery.problem ?? weight.problem ?? screen.problem ?? returns.problem ?? ram.problem ?? storage.problem;
  if (problem) return { problem };
  const specs = {
    ...(ram.value !== undefined ? { ramGb: ram.value } : {}),
    ...(storage.value !== undefined ? { storageGb: storage.value } : {}),
    ...(battery.value !== undefined ? { batteryHours: battery.value } : {}),
    ...(weight.value !== undefined ? { weightLb: weight.value } : {}),
    ...(screen.value !== undefined ? { screenInches: screen.value } : {}),
  };
  return {
    product: {
      name,
      price,
      availability: row.availability,
      category: row.category,
      ...(row.subcategory.trim() ? { subcategory: row.subcategory.trim() } : {}),
      ...(Object.keys(specs).length ? { specs } : {}),
      ...(returns.value !== undefined ? { returnPolicyDays: returns.value } : {}),
    },
  };
}

// The screen-specific sentence replaces the generic hint (whose wording is about incidents).
function describe(error: unknown): unknown {
  if (error instanceof ApiError) {
    if (error.code === "CONFLICT") return new ApiError("A brand with this name already exists. Choose a different brand name.", null, error.status);
    if (error.code === "NOT_FOUND")
      return new ApiError("Brand onboarding isn't available on the backend yet, so nothing was created.", null, error.status);
  }
  return error;
}

export default function ConnectCatalog() {
  const [brandName, setBrandName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [rows, setRows] = useState<CatalogRow[]>([emptyRow()]);
  const [problems, setProblems] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [csvNotes, setCsvNotes] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [done, setDone] = useState<OnboardResponse | null>(null);

  const update = (index: number, change: Partial<CatalogRow>) =>
    setRows((list) => list.map((r, i) => (i === index ? { ...r, ...change } : r)));

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setCsvNotes([`That file is too large (limit ${MAX_FILE_BYTES / 1_000_000} MB).`]);
    const { rows: parsed, problems: notes } = isExcel(file) ? await parseCatalogXlsx(file) : parseCatalogCsv(await file.text());
    if (parsed.length > 0) {
      setRows(parsed);
      setPage(0);
    }
    setCsvNotes(parsed.length > 0 ? [`Loaded ${parsed.length.toLocaleString()} products from ${file.name}. Check them below.`, ...notes.slice(0, 20), ...(notes.length > 20 ? [`…and ${notes.length - 20} more notes.`] : [])] : notes);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: string[] = [];
    if (!brandName.trim()) found.push("Enter a brand name.");
    if (!ownerName.trim()) found.push("Enter an owner name.");
    const products: OnboardProduct[] = [];
    rows.forEach((row, i) => {
      const { product, problem } = toProduct(row, i + 1);
      if (problem) found.push(problem);
      else if (product) products.push(product);
    });
    setProblems(found.length > 20 ? [...found.slice(0, 20), `…and ${found.length - 20} more to fix.`] : found);
    if (found.length > 0) return;
    const body: OnboardRequest = { brandName: brandName.trim(), ownerName: ownerName.trim(), products };
    setSending(true);
    setError(undefined);
    try {
      setDone(await onboardBrand(body));
    } catch (e) {
      setError(describe(e));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="card stack" aria-live="polite">
        <h2>{done.brandName} is connected</h2>
        <p>
          {done.productsCreated} product{done.productsCreated === 1 ? "" : "s"} added
          {done.connectorReady ? ". AI assistants can now get verified answers about them." : "."}
        </p>
        <div>
          <p className="eyebrow">Your brand key</p>
          <p>
            <code className="key-box">{done.apiKey}</code>
          </p>
          <p className="muted small">Brand id {done.brandId}. Keep the key for the client API.</p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => {
              signInAs({ brandId: done.brandId, brandName: done.brandName, role: "owner", apiKey: done.apiKey });
              window.location.assign("/dashboard");
            }}
          >
            Sign in as this brand
          </button>
        </div>
        <p className="muted small">{done.note || "Demo data. Resets when the server restarts."}</p>
      </section>
    );
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <section className="card stack">
        <h2>Your brand</h2>
        <div className="constraints-grid">
          <label className="field">
            Brand name
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} autoComplete="organization" />
          </label>
          <label className="field">
            Owner name
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
          </label>
        </div>
      </section>

      <section className="card stack">
        <div className="filters">
          <h2 className="grow">Products ({rows.length.toLocaleString()})</h2>
          <label className="button button-secondary file-button">
            Upload Excel or CSV
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </label>
        </div>
        <p className="muted small">
          Upload an .xlsx or .csv with one product per row and a header row. We match columns by name, in any order
          (name, price, availability or stock, category, subcategory, RAM, storage, battery, weight, screen, return days),
          fill in the table below and ignore what we do not use. Only name and price are required. There is no limit on
          the number of products.
        </p>
        {csvNotes.length > 0 && (
          <ul className="notes" role="status">
            {csvNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price (USD)</th>
                <th>Availability</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>RAM (GB)</th>
                <th>Storage (GB)</th>
                <th>Battery (hours)</th>
                <th>Weight (lb)</th>
                <th>Screen (inches)</th>
                <th>Return days</th>
                <th>
                  <span className="visually-hidden">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, offset) => {
                const i = page * PAGE_SIZE + offset;
                return (
                <tr key={i}>
                  <td>
                    <input aria-label={`Product ${i + 1} name`} value={row.name} onChange={(e) => update(i, { name: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} price`} inputMode="decimal" value={row.price} onChange={(e) => update(i, { price: e.target.value })} />
                  </td>
                  <td>
                    <Dropdown
                      label={`Product ${i + 1} availability`}
                      hideLabel
                      compact
                      value={row.availability}
                      onChange={(v) => update(i, { availability: v as CatalogRow["availability"] })}
                      options={AVAILABILITY_VALUES.map((v) => ({ value: v, label: AVAILABILITY_LABELS[v] }))}
                    />
                  </td>
                  <td>
                    <Dropdown
                      label={`Product ${i + 1} category`}
                      hideLabel
                      compact
                      value={row.category}
                      onChange={(v) => update(i, { category: v as CatalogRow["category"] })}
                      options={PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                    />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} subcategory`} value={row.subcategory} onChange={(e) => update(i, { subcategory: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} RAM in GB`} inputMode="decimal" value={row.ramGb} onChange={(e) => update(i, { ramGb: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} storage in GB`} inputMode="decimal" value={row.storageGb} onChange={(e) => update(i, { storageGb: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} battery hours`} inputMode="decimal" value={row.batteryHours} onChange={(e) => update(i, { batteryHours: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} weight in pounds`} inputMode="decimal" value={row.weightLb} onChange={(e) => update(i, { weightLb: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} screen inches`} inputMode="decimal" value={row.screenInches} onChange={(e) => update(i, { screenInches: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Product ${i + 1} return days`} inputMode="numeric" value={row.returnPolicyDays} onChange={(e) => update(i, { returnPolicyDays: e.target.value })} />
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => {
                        setRows((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [emptyRow()]));
                        if (offset === 0 && page > 0 && i === rows.length - 1) setPage(page - 1);
                      }} aria-label={`Remove product ${i + 1}`}>
                      Remove
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <div className="button-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setRows((list) => [...list, emptyRow()]);
                setPage(Math.floor(rows.length / PAGE_SIZE));
              }}
            >
              Add a product
            </button>
            {rows.length > PAGE_SIZE && (
              <>
                <button type="button" className="button button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span className="muted small" role="status">
                  Showing {page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length.toLocaleString()}
                </span>
                <button type="button" className="button button-secondary" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {problems.length > 0 && (
        <ul className="state-error notes" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error !== undefined && <ErrorNotice error={error} />}

      <div className="button-row">
        <button type="submit" className="button" disabled={sending}>
          {sending ? "Connecting…" : "Connect my catalog"}
        </button>
      </div>
      <p className="muted small">Demo data: brands you create here reset when the server restarts.</p>
    </form>
  );
}
