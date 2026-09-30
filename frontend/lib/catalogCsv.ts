// Reads a product catalog from CSV text for the "Connect your catalog" page.
// Columns (header row required, any order): name, price, availability, batteryHours, weightLb,
// screenInches, returnPolicyDays. Only name and price must have a value (contract v1.3, section 7b).
import type { Availability } from "./types";

export const CATALOG_COLUMNS = ["name", "price", "availability", "batteryHours", "weightLb", "screenInches", "returnPolicyDays"] as const;
export const AVAILABILITY_VALUES: Availability[] = ["in_stock", "low_stock", "out_of_stock"];
export const MAX_PRODUCTS = 50;

/** One row in the product table. Everything is text while it is being edited. */
export interface CatalogRow {
  name: string;
  price: string;
  availability: Availability;
  batteryHours: string;
  weightLb: string;
  screenInches: string;
  returnPolicyDays: string;
}

export function emptyRow(): CatalogRow {
  return { name: "", price: "", availability: "in_stock", batteryHours: "", weightLb: "", screenInches: "", returnPolicyDays: "" };
}

/** Splits CSV text into rows of cells. Handles quoted cells, "" escapes, CRLF and a leading BOM. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseCatalogCsv(text: string): { rows: CatalogRow[]; problems: string[] } {
  const table = splitCsv(text);
  if (table.length === 0) return { rows: [], problems: ["The file is empty."] };
  const header = table[0].map((h) => h.trim());
  const missing = ["name", "price"].filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], problems: [`The first row must name the columns. Missing: ${missing.join(", ")}. Expected: ${CATALOG_COLUMNS.join(", ")}.`] };
  }
  const problems: string[] = [];
  const unknown = header.filter((h) => h !== "" && !(CATALOG_COLUMNS as readonly string[]).includes(h));
  if (unknown.length > 0) problems.push(`Ignored unknown columns: ${unknown.join(", ")}.`);
  const rows: CatalogRow[] = [];
  table.slice(1).forEach((cells, index) => {
    const get = (col: string) => (cells[header.indexOf(col)] ?? "").trim();
    const row = emptyRow();
    row.name = get("name");
    row.price = get("price");
    row.batteryHours = get("batteryHours");
    row.weightLb = get("weightLb");
    row.screenInches = get("screenInches");
    row.returnPolicyDays = get("returnPolicyDays");
    const availability = get("availability");
    if (availability !== "") {
      if ((AVAILABILITY_VALUES as string[]).includes(availability)) row.availability = availability as Availability;
      else problems.push(`Row ${index + 1}: availability "${availability}" is not one of ${AVAILABILITY_VALUES.join(", ")}. Using in_stock.`);
    }
    rows.push(row);
  });
  if (rows.length === 0) problems.push("The file has a header row but no products.");
  return { rows, problems };
}
