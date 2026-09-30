// Reads a product catalog from a spreadsheet (.xlsx) or CSV for the "Connect your catalog" page.
// Headers can be in any order and are matched loosely ("Price ($)", "Product Name", "Battery Life (hrs)"),
// and cell values are cleaned up ("$1,299.00", "In Stock", a stock count). Only name and price must have
// a value (contract v1.3, section 7b). There is no cap on the number of products.
import { PRODUCT_CATEGORIES } from "./categories";
import type { ProductCategory } from "./categories";
import type { Availability } from "./types";

export const CATALOG_COLUMNS = [
  "name", "price", "availability", "category", "subcategory", "ramGb", "storageGb",
  "batteryHours", "weightLb", "screenInches", "returnPolicyDays",
] as const;
export type CatalogColumn = (typeof CATALOG_COLUMNS)[number];
export const AVAILABILITY_VALUES: Availability[] = ["in_stock", "low_stock", "out_of_stock"];
export const LOW_STOCK_UNITS = 10;

/** One row in the product table. Everything is text while it is being edited. */
export interface CatalogRow {
  name: string;
  price: string;
  availability: Availability;
  category: ProductCategory;
  subcategory: string;
  ramGb: string;
  storageGb: string;
  batteryHours: string;
  weightLb: string;
  screenInches: string;
  returnPolicyDays: string;
}

export function emptyRow(): CatalogRow {
  return {
    name: "", price: "", availability: "in_stock", category: "laptops", subcategory: "",
    ramGb: "", storageGb: "", batteryHours: "", weightLb: "", screenInches: "", returnPolicyDays: "",
  };
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

// Header text (letters and digits only, lower case) -> the column it fills.
const HEADER_ALIASES: Record<string, CatalogColumn> = {};
const alias = (column: CatalogColumn, ...names: string[]) => names.forEach((n) => (HEADER_ALIASES[squash(n)] = column));
alias("name", "name", "product", "product name", "title", "item", "item name", "model");
alias("price", "price", "price usd", "price ($)", "unit price", "msrp", "retail price", "cost", "list price", "amount");
alias("availability", "availability", "stock", "stock status", "in stock", "inventory", "quantity", "qty", "units", "status");
alias("category", "category", "product category", "type", "product type", "department");
alias("subcategory", "subcategory", "sub category", "sub-category", "segment", "product line");
alias("ramGb", "ram", "ram gb", "ram (gb)", "memory", "memory gb");
alias("storageGb", "storage", "storage gb", "storage (gb)", "disk", "ssd", "capacity", "capacity gb");
alias("batteryHours", "battery", "battery hours", "battery life", "battery life hours", "battery (hours)", "battery life (hrs)", "battery hrs");
alias("weightLb", "weight", "weight lb", "weight (lb)", "weight lbs", "weight (lbs)", "weight pounds");
alias("screenInches", "screen", "screen inches", "screen size", "screen (inches)", "display", "display size", "display inches");
alias("returnPolicyDays", "return days", "return policy", "return policy days", "returns", "return window", "return period");

const CATEGORY_WORDS: [RegExp, ProductCategory][] = [
  [/head|ear|audio|buds|airpod|speaker/, "headphones"],
  [/laptop|notebook|chromebook|macbook|ultrabook/, "laptops"],
  [/phone|tablet|ipad|mobile|smartphone/, "phones_tablets"],
  [/hardware|component|gpu|cpu|monitor|keyboard|mouse|ssd|drive|router|peripheral|accessor/, "computer_hardware"],
];

/** "$1,299.00" -> "1299". Leaves anything it cannot read alone so validation can point at it. */
export function cleanNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : "";
  const text = String(raw).trim();
  if (text === "") return "";
  const stripped = text.replace(/[$€£,\s]/g, "").replace(/(usd|lbs?|hrs?|hours?|days?|gb|in|inches|")$/i, "");
  return stripped !== "" && Number.isFinite(Number(stripped)) ? String(Number(stripped)) : text;
}

/** Availability from words ("In Stock", "sold out", "yes") or a stock count (0 = out, few = low). */
export function cleanAvailability(raw: unknown): Availability | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean") return raw ? "in_stock" : "out_of_stock";
  if (typeof raw === "number") return raw <= 0 ? "out_of_stock" : raw <= LOW_STOCK_UNITS ? "low_stock" : "in_stock";
  const text = String(raw).trim().toLowerCase();
  if (text === "") return null;
  if (/^\d+(\.\d+)?$/.test(text)) return cleanAvailability(Number(text));
  if (/out|sold|unavail|none|no stock|discontinu|^(no|n|false|0)$/.test(text)) return "out_of_stock";
  if (/low|limited|few|last|backorder|preorder/.test(text)) return "low_stock";
  if (/in.?stock|avail|yes|^(y|true|1)$/.test(text)) return "in_stock";
  return null;
}

export function cleanCategory(raw: unknown): ProductCategory | null {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "") return null;
  const exact = PRODUCT_CATEGORIES.find((c) => c.value === text || c.label.toLowerCase() === text);
  if (exact) return exact.value;
  return CATEGORY_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
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

const cellText = (raw: unknown): string => (raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "").trim());

/**
 * Turns a table of cells (first non-empty row = headers) into product rows. Used for both .xlsx and .csv.
 * Columns are recognised by name whatever their order or capitalisation; the rest are reported as ignored.
 */
export function parseCatalogTable(table: unknown[][]): { rows: CatalogRow[]; problems: string[] } {
  const filled = table.filter((r) => r.some((c) => cellText(c) !== ""));
  if (filled.length === 0) return { rows: [], problems: ["The file is empty."] };
  const columnAt: (CatalogColumn | null)[] = filled[0].map((h) => HEADER_ALIASES[squash(cellText(h))] ?? null);
  const missing = (["name", "price"] as const).filter((c) => !columnAt.includes(c));
  if (missing.length > 0) {
    return { rows: [], problems: [`The first row must name the columns. Could not find: ${missing.join(", ")}. Expected columns like: ${CATALOG_COLUMNS.join(", ")}.`] };
  }
  const problems: string[] = [];
  const ignored = filled[0].map((h, i) => ({ h: cellText(h), i })).filter(({ h, i }) => h !== "" && columnAt[i] === null).map(({ h }) => h);
  if (ignored.length > 0) problems.push(`Ignored columns we don't use: ${ignored.join(", ")}.`);

  const rows: CatalogRow[] = [];
  filled.slice(1).forEach((cells, index) => {
    const get = (col: CatalogColumn): unknown => {
      const at = columnAt.indexOf(col);
      return at === -1 ? "" : cells[at];
    };
    const row = emptyRow();
    row.name = cellText(get("name"));
    row.price = cleanNumber(get("price"));
    row.subcategory = cellText(get("subcategory"));
    for (const col of ["ramGb", "storageGb", "batteryHours", "weightLb", "screenInches", "returnPolicyDays"] as const) {
      row[col] = cleanNumber(get(col));
    }
    const rawAvailability = get("availability");
    const availability = cleanAvailability(rawAvailability);
    if (availability) row.availability = availability;
    else if (cellText(rawAvailability) !== "") problems.push(`Row ${index + 1}: could not read availability "${cellText(rawAvailability)}". Using in_stock.`);
    const rawCategory = get("category");
    const category = cleanCategory(rawCategory);
    if (category) row.category = category;
    else if (cellText(rawCategory) !== "") problems.push(`Row ${index + 1}: unknown category "${cellText(rawCategory)}". Using laptops.`);
    else if (columnAt.includes("name")) row.category = cleanCategory(row.name) ?? row.category; // "AirPods Pro" -> headphones
    rows.push(row);
  });
  if (rows.length === 0) problems.push("The file has a header row but no products.");
  return { rows, problems };
}

export function parseCatalogCsv(text: string): { rows: CatalogRow[]; problems: string[] } {
  return parseCatalogTable(splitCsv(text));
}

/** Reads the first sheet of an .xlsx file in the browser. The parser is only loaded when someone uploads one. */
export async function parseCatalogXlsx(file: File): Promise<{ rows: CatalogRow[]; problems: string[] }> {
  const { readSheet } = await import("read-excel-file/browser");
  try {
    return parseCatalogTable((await readSheet(file)) as unknown[][]);
  } catch {
    return { rows: [], problems: ["That file could not be read as an Excel workbook (.xlsx). Older .xls files should be saved as .xlsx or .csv first."] };
  }
}
