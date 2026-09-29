// The single place where the frontend talks to the backend.
//
// Pages never call fetch() directly. They call the typed functions below, so the
// backend address, the mock-data switch and error handling live in one spot.
//
// Settings (read at build time, so restart `npm run dev` after changing them):
//   NEXT_PUBLIC_API_URL   Backend address, e.g. https://frontdoor-api.onrender.com
//   NEXT_PUBLIC_USE_MOCK  "true" = load example data from shared/mock/ instead
//                         of the live backend. Anything else = live backend.
//
// Endpoints, fields and types come from BACKEND_CONTRACT.md. Do not add
// endpoints here that are not in the contract.
//
// These functions are meant to be called from the browser (client components).

import type {
  ApiErrorBody,
  ApiErrorCode,
  Incident,
  IncidentFilters,
  IncidentsResponse,
  TrustMetrics,
  VisibilitySummary,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const TIMEOUT_MS = 8000;

type Query = Record<string, string | number | undefined>;

// Thrown by every function below when a call fails. `code` is the contract's
// error code, or null when the backend could not be reached or sent no
// contract-shaped error (network down, timeout, bad JSON).
export class ApiError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode | null = null,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Endpoints (BACKEND_CONTRACT.md section 7) ----

// GET /api/v1/visibility/summary?days=  (days: 1 to 30, default 30)
export function getVisibilitySummary(days?: number): Promise<VisibilitySummary> {
  return apiGet<VisibilitySummary>("/api/v1/visibility/summary", { days }, "visibility_summary");
}

// GET /api/v1/metrics/trust?days=  (`daily` has exactly `days` entries, oldest first)
export async function getTrustMetrics(days?: number): Promise<TrustMetrics> {
  const data = await apiGet<TrustMetrics>("/api/v1/metrics/trust", { days }, "metrics_trust");
  if (USE_MOCK && days !== undefined) {
    return { ...data, periodDays: days, daily: data.daily.slice(-days) };
  }
  return data;
}

// GET /api/v1/incidents?status=&severity=&limit=  (filters optional, newest first)
export async function getIncidents(filters: IncidentFilters = {}): Promise<IncidentsResponse> {
  const data = await apiGet<IncidentsResponse>("/api/v1/incidents", { ...filters }, "incidents");
  if (USE_MOCK) {
    // Apply the same filters the backend would, so mock and live behave alike.
    const { status, severity, limit = 50 } = filters;
    return {
      incidents: data.incidents
        .filter((i) => !status || i.status === status)
        .filter((i) => !severity || i.severity === severity)
        .slice(0, limit),
    };
  }
  return data;
}

// "Open" is not a status in the contract; the contract says resolvedAt is null
// while an incident is open. PENDING LEAD CONFIRMATION.
export function isOpenIncident(incident: Incident): boolean {
  return incident.resolvedAt === null;
}

// Asks the live backend's /health endpoint whether it is up. This always checks
// the real backend, even in mock mode, so the footer tells the truth.
export async function checkHealth(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const res = await fetchWithTimeout(`${API_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Plumbing ----

async function apiGet<T>(path: string, query: Query, mockFile: string): Promise<T> {
  if (USE_MOCK) {
    return readJson<T>(await fetchOrThrow(`/mock/${mockFile}`));
  }
  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not set");
  }
  return readJson<T>(await fetchOrThrow(`${API_URL}${path}${toQueryString(query)}`, { cache: "no-store" }));
}

function toQueryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function readJson<T>(res: Response): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, null, res.status);
  }
  if (!res.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.message, body.error.code, res.status);
    }
    throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, null, res.status);
  }
  return body as T;
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  const error = (body as ApiErrorBody | null)?.error;
  return typeof error?.code === "string" && typeof error?.message === "string";
}

async function fetchOrThrow(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init);
  } catch {
    throw new ApiError("Could not reach the backend");
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
