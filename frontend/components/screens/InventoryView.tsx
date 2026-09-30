"use client";

import { useCallback, useEffect, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { Toast, useToast } from "@/components/Toast";
import { getInventory, importInventory, removeInventoryItem, updateInventoryItem } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { useUserSession } from "@/lib/auth/userSession";
import { catalogRowToProduct, emptyRow, parseCatalogCsv, parseCatalogXlsx } from "@/lib/catalogCsv";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/lib/categories";
import type { ProductCategory } from "@/lib/categories";
import { formatDateTime, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import type { Tone } from "@/lib/tones";
import type { Availability, InventoryResponse, OnboardProduct, Product } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const PAGE_SIZE = 25;
const MAX_FILE_BYTES = 25_000_000;
const STOCK_TONES: Record<Availability, Tone> = { in_stock: "good", low_stock: "warn", out_of_stock: "bad" };
const AVAILABILITY_OPTIONS = (Object.keys(AVAILABILITY_LABELS) as Availability[]).map((v) => ({ value: v, label: AVAILABILITY_LABELS[v] }));

interface Pending {
  fileName: string;
  products: OnboardProduct[];
  problems: string[];
}

const ADD_HINT = "This is the verified catalog. Change a price or stock level and it updates straight away: AI answers are checked against it and the change is written to the audit log.";

const isExcel = (file: File) => /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Inventory = the signed-in company's own products: stock, prices and details you can change, and a spreadsheet upload that adds or updates them in bulk. */
export default function InventoryView() {
  const session = useUserSession();
  const brand = useBrandSession();
  const { toast, show, hide } = useToast();
  // CIRQO Staff belong to no company, so they see every company's products with the company named.
  const showCompany = session.user?.staff === true;
  const canEdit = session.user?.role === "owner" && !session.user.staff && (session.user.backend === true || Boolean(brand?.apiKey));

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [availability, setAvailability] = useState<Availability | "">("");
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<ProductCategory>("laptops");
  const [newStock, setNewStock] = useState<Availability>("in_stock");
  const [kept, setKept] = useState<InventoryResponse | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const inventory = useApi(
    useCallback(
      () => getInventory({ q: q || undefined, category: category || undefined, availability: availability || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
      [q, category, availability, page],
    ),
  );
  // Keep showing the last list while a fresh one loads, so editing a row does not blank the table.
  if (inventory.data && inventory.data !== kept) setKept(inventory.data);
  const data = inventory.data ?? kept;
  const summary = data?.summary;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  async function change(product: Product, patch: Parameters<typeof updateInventoryItem>[1], what: string) {
    setBusy(true);
    try {
      await updateInventoryItem(product.productId, patch);
      show(`${product.name}: ${what}.`);
      inventory.reload();
    } catch (e) {
      show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove ${product.name} from your catalog? AI answers about it will no longer be checked.`)) return;
    setBusy(true);
    try {
      await removeInventoryItem(product.productId);
      show(`${product.name} was removed.`);
      inventory.reload();
    } catch (e) {
      show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return show(`That file is too large (limit ${MAX_FILE_BYTES / 1_000_000} MB).`, "error");
    const { rows, problems } = isExcel(file) ? await parseCatalogXlsx(file) : parseCatalogCsv(await file.text());
    const products: OnboardProduct[] = [];
    const notes = [...problems];
    rows.forEach((row, i) => {
      const { product, problem } = catalogRowToProduct(row, i + 1);
      if (product) products.push(product);
      else if (problem) notes.push(problem);
    });
    if (products.length === 0) return show(notes[0] ?? "No products found in that file.", "error");
    setPending({ fileName: file.name, products, problems: notes });
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await importInventory(pending.products);
      const skipped = result.skipped.length ? `, ${result.skipped.length} skipped (names used by another company)` : "";
      show(`${result.created.toLocaleString()} added, ${result.updated.toLocaleString()} updated${skipped}.`);
      setPending(null);
      inventory.reload();
    } catch (e) {
      show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function addOne(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row = { ...emptyRow(), name: String(form.get("name") ?? ""), price: String(form.get("price") ?? ""), category: newCategory, availability: newStock };
    const { product, problem } = catalogRowToProduct(row, 1);
    if (!product) return show(problem?.replace(/^Product 1: /, "") ?? "Check the product.", "error");
    setBusy(true);
    try {
      await importInventory([product]);
      show(`${product.name} was added.`);
      setAdding(false);
      inventory.reload();
    } catch (e) {
      show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const stats: { label: string; value: number | undefined; filter: Availability | ""; tone?: string }[] = [
    { label: "Products", value: summary?.total, filter: "" },
    { label: "In stock", value: summary?.inStock, filter: "in_stock" },
    { label: "Low stock", value: summary?.lowStock, filter: "low_stock" },
    { label: "Out of stock", value: summary?.outOfStock, filter: "out_of_stock" },
  ];

  return (
    <div className="stack">
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            className="card stat stat-button"
            aria-pressed={availability === s.filter}
            onClick={() => {
              setAvailability(s.filter);
              setPage(0);
            }}
          >
            <span className="muted small">{s.label}</span>
            <strong className="stat-value">{s.value === undefined ? "…" : s.value.toLocaleString()}</strong>
          </button>
        ))}
      </div>

      <section className="card stack">
        <div className="filters">
          <label className="field grow">
            Search products
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" />
          </label>
          <Dropdown
            label="Category"
            compact
            value={category}
            onChange={(v) => {
              setCategory(v as ProductCategory | "");
              setPage(0);
            }}
            options={[{ value: "", label: "All categories" }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
          />
          <Dropdown
            label="Stock"
            compact
            value={availability}
            onChange={(v) => {
              setAvailability(v as Availability | "");
              setPage(0);
            }}
            options={[{ value: "", label: "All stock levels" }, ...AVAILABILITY_OPTIONS]}
          />
          {canEdit && (
            <>
              <label className="button button-secondary file-button">
                Upload Excel or CSV
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy}
                  onChange={(e) => {
                    void chooseFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" className="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
                Add a product
              </button>
            </>
          )}
        </div>

        {!canEdit && (
          <p className="muted small" role="note">
            {session.user?.role === "viewer"
              ? "Viewers can see the inventory but not change it."
              : "Sign in as a company owner to change prices and stock or upload a spreadsheet."}
          </p>
        )}
        {canEdit && <p className="muted small">{ADD_HINT}</p>}

        {pending && (
          <div className="card stack" role="status">
            <p>
              <strong>{pending.fileName}</strong>: ready to add or update {pending.products.length.toLocaleString()} product
              {pending.products.length === 1 ? "" : "s"}. Products whose name is already in your catalog are updated; the rest are added.
            </p>
            {pending.problems.length > 0 && (
              <ul className="notes">
                {pending.problems.slice(0, 10).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {pending.problems.length > 10 && <li>…and {pending.problems.length - 10} more notes. Those rows are left out.</li>}
              </ul>
            )}
            <div className="button-row">
              <button type="button" className="button" disabled={busy} onClick={() => void confirmImport()}>
                {busy ? "Importing…" : "Import to my catalog"}
              </button>
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {adding && canEdit && (
          <form className="constraints-grid" onSubmit={(e) => void addOne(e)} noValidate>
            <label className="field">
              Name
              <input name="name" autoComplete="off" />
            </label>
            <label className="field">
              Price (USD)
              <input name="price" inputMode="decimal" />
            </label>
            <Dropdown
              label="Category"
              value={newCategory}
              onChange={(v) => setNewCategory(v as ProductCategory)}
              options={PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <Dropdown label="Stock" value={newStock} onChange={(v) => setNewStock(v as Availability)} options={AVAILABILITY_OPTIONS} />
            <div className="button-row">
              <button type="submit" className="button" disabled={busy}>
                Save product
              </button>
            </div>
          </form>
        )}

        {inventory.loading && !data && <Loading what="inventory" />}
        {inventory.error !== undefined && <ErrorNotice error={inventory.error} onRetry={inventory.reload} />}
        {data && data.items.length === 0 && <Empty>{summary?.total ? "No products match these filters." : "No products yet. Upload a spreadsheet or add one."}</Empty>}
        {data && data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="cells-middle">
                <thead>
                  <tr>
                    <th>Product</th>
                    {showCompany && <th>Company</th>}
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Verified</th>
                    <th>Last changed</th>
                    {canEdit && (
                      <th>
                        <span className="visually-hidden">Remove</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      {showCompany && <td>{p.brandName}</td>}
                      <td>
                        {categoryLabel(p.category ?? "laptops")}
                        {p.subcategory && <span className="muted small"> · {p.subcategory}</span>}
                      </td>
                      <td className="nowrap">
                        {canEdit ? (
                          <PriceCell key={p.price} product={p} disabled={busy} onSave={(price) => change(p, { price }, `price set to ${formatPrice(price)}`)} />
                        ) : (
                          formatPrice(p.price)
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <Dropdown
                            label={`${p.name} stock`}
                            hideLabel
                            compact
                            value={p.availability}
                            onChange={(v) => void change(p, { availability: v as Availability }, `now ${AVAILABILITY_LABELS[v as Availability].toLowerCase()}`)}
                            options={AVAILABILITY_OPTIONS}
                          />
                        ) : (
                          <StatusPill tone={STOCK_TONES[p.availability]}>{AVAILABILITY_LABELS[p.availability]}</StatusPill>
                        )}
                      </td>
                      <td>
                        {p.verified === undefined ? (
                          "—"
                        ) : (
                          <StatusPill tone={p.verified ? "good" : "warn"}>{p.verified ? "CIRQO Verified" : "Not CIRQO Verified"}</StatusPill>
                        )}
                      </td>
                      <td className="nowrap">{formatDateTime(p.updatedAt)}</td>
                      {canEdit && (
                        <td>
                          <button type="button" className="link-button" disabled={busy} onClick={() => void remove(p)} aria-label={`Remove ${p.name}`}>
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="button-row">
              <button type="button" className="button button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="muted small" role="status">
                Page {page + 1} of {pages.toLocaleString()} · {data.total.toLocaleString()} product{data.total === 1 ? "" : "s"}
              </span>
              <button type="button" className="button button-secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
      <Toast toast={toast} onClose={hide} />
    </div>
  );
}

/** A price that saves when you leave the box or press Enter, and only when it actually changed. */
function PriceCell({ product, disabled, onSave }: { product: Product; disabled: boolean; onSave: (price: number) => void }) {
  const [text, setText] = useState(String(product.price));
  function commit() {
    const price = Number(text.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(price) || price <= 0) return setText(String(product.price));
    if (price !== product.price) onSave(price);
  }
  return (
    <input
      aria-label={`${product.name} price in USD`}
      inputMode="decimal"
      size={8}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
