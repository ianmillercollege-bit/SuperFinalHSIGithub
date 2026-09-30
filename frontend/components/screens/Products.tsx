"use client";

import { useCallback, useMemo, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import { getProducts } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/lib/categories";
import { formatDateTime, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { useApi } from "@/lib/useApi";

const PAGE_SIZE = 25;
// v1.4.1: products carry a category. Older backends send none; those products are laptops.
const DEFAULT_CATEGORY = "laptops";

/** Products = GET /products?category=&brandId= (contract v1.4.1): the verified catalog, with a category filter. */
export default function Products() {
  const brand = useBrandSession();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const brandId = brand?.brandId;
  const products = useApi(useCallback(() => getProducts({ category: category || undefined, brandId }), [category, brandId]));

  // The backend filters when it can; filtering again here keeps the list right on older backends that ignore ?category=.
  const rows = useMemo(
    () => (products.data?.products ?? []).filter((p) => !category || (p.category ?? DEFAULT_CATEGORY) === category),
    [products.data, category],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="stack">
      <section className="card stack">
        <div className="filters">
          <div className="grow">
            <h2>
              Verified products
              {products.data && <span className="count">{rows.length}</span>}
            </h2>
            <p className="muted small">
              {brand ? `The verified catalog for ${brand.brandName}.` : "The verified catalog for every company."} Prices, specs and
              availability here are what CIRQO checks AI answers against.
            </p>
          </div>
          <Dropdown
            label="Category"
            compact
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
            options={[{ value: "", label: "All categories" }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
          />
        </div>
        {products.loading && <Loading what="products" />}
        {products.error !== undefined && <ErrorNotice error={products.error} onRetry={products.reload} />}
        {products.data && rows.length === 0 && <Empty>No products in this category yet.</Empty>}
        {products.data && rows.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Company</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Availability</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      <td>{p.brandName}</td>
                      <td>
                        {categoryLabel(p.category ?? DEFAULT_CATEGORY)}
                        {p.subcategory && <span className="muted small"> · {p.subcategory}</span>}
                      </td>
                      <td className="nowrap">{formatPrice(p.price)}</td>
                      <td>{AVAILABILITY_LABELS[p.availability]}</td>
                      <td className="nowrap">{formatDateTime(p.verifiedAt ?? p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="button-row">
                <button type="button" className="button button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span className="muted small">
                  Page {page + 1} of {pages}
                </span>
                <button type="button" className="button button-secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
