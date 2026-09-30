"use client";

import { useMemo, useState } from "react";
import type { StorefrontRevenueData } from "@/lib/dashboard/types";

const WINDOWS = [7, 30] as const;
const W = 520;
const H = 150;

const money = (v: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
const sum = (rows: { revenue: number; orders: number }[], key: "revenue" | "orders") => rows.reduce((a, r) => a + r[key], 0);

/** Shopify storefront revenue: the total, its change against the period before, a daily line, orders, average order value and the AI-assisted share. */
export default function StorefrontRevenue({ data }: { data: StorefrontRevenueData }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30);

  const view = useMemo(() => {
    const now = data.days.slice(-windowDays);
    const before = data.days.slice(-windowDays * 2, -windowDays);
    const revenue = sum(now, "revenue");
    const previous = sum(before, "revenue");
    const orders = sum(now, "orders");
    const values = now.map((d) => d.revenue);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const x = (i: number) => (values.length < 2 ? 0 : (i / (values.length - 1)) * W);
    const y = (v: number) => 10 + (1 - (hi === lo ? 0.5 : (v - lo) / (hi - lo))) * (H - 20);
    const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    return {
      revenue,
      orders,
      change: previous > 0 ? (revenue - previous) / previous : 0,
      aov: orders > 0 ? revenue / orders : 0,
      line,
      area: `${line} L${W} ${H} L0 ${H} Z`,
      lastX: x(values.length - 1),
      lastY: y(values[values.length - 1]),
    };
  }, [data.days, windowDays]);

  const C = 2 * Math.PI * 38;
  const pct = Math.round(view.change * 1000) / 10;
  const up = view.change >= 0;
  return (
    <section className="cq-card cq-shop" aria-labelledby="cq-shop-title">
      <div className="cq-chart-head">
        <div className="cq-shop-title">
          <h2 className="cq-h2" id="cq-shop-title">
            Shopify storefront revenue
          </h2>
          {data.sample && <span className="cq-pill is-neutral">Sample</span>}
        </div>
        <div className="cq-chips" role="group" aria-label="Time period">
          {WINDOWS.map((n) => (
            <button key={n} type="button" className="cq-chip is-pill" aria-pressed={windowDays === n} onClick={() => setWindowDays(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>

      <div className="cq-shop-body">
        <div className="cq-shop-total">
          <span className="cq-shop-value">{money(view.revenue, data.currency)}</span>
          <span className={`cq-shop-delta${up ? "" : " is-bad"}`}>
            {up ? "Up" : "Down"} {Math.abs(pct)}% vs the previous {windowDays} days
          </span>
          <span className="cq-stat-note">Sales through your Shopify storefront. Sample figures: live Shopify sales are not connected yet.</span>
        </div>

        <div className="cq-shop-chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Daily storefront revenue over the last ${windowDays} days, ${money(view.revenue, data.currency)} in total`}>
            <path className="area" d={view.area} />
            <path className="line" d={view.line} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="cq-shop-axis">
            <span>{windowDays} days ago</span>
            <span>Today</span>
          </div>
        </div>

        <dl className="cq-shop-facts">
          <div>
            <dt>Orders</dt>
            <dd>{view.orders.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Average order</dt>
            <dd>{money(view.aov, data.currency)}</dd>
          </div>
          <div className="cq-shop-ai">
            <svg className="cq-shop-ring" viewBox="0 0 96 96" role="img" aria-label={`${Math.round(data.aiShare * 100)} percent of revenue came from AI shopping assistants`}>
              <circle className="track" cx="48" cy="48" r="38" />
              <circle className="arc" cx="48" cy="48" r="38" strokeDasharray={`${(data.aiShare * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 48 48)" />
              <text x="48" y="54" textAnchor="middle">
                {Math.round(data.aiShare * 100)}%
              </text>
            </svg>
            <div>
              <dt>From AI assistants</dt>
              <dd className="cq-shop-ai-note">Share of revenue from shoppers sent by AI</dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
