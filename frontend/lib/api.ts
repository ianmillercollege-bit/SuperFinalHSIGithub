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
// Endpoints, fields and types come from BACKEND_CONTRACT.md (FINAL v1.1). Do not
// add endpoints here that are not in the contract.
//
// These functions are meant to be called from the browser (client components).

import { USE_MOCK } from "./config";
import type {
  AnswerFilters,
  AnswersResponse,
  ApiErrorBody,
  ApiErrorCode,
  ApproveRequest,
  AuditFilters,
  AuditResponse,
  CheckerRunRequest,
  CheckerRunResponse,
  ConnectorQueryRequest,
  ConnectorQueryResponse,
  ClaimFilters,
  ClaimsResponse,
  HealthResponse,
  Incident,
  IncidentFilters,
  IncidentsResponse,
  OwnersResponse,
  ProductsResponse,
  RecommendRequest,
  RecommendResponse,
  RejectRequest,
  Report,
  ResolveRequest,
  ShopperQuestionsResponse,
  SourcesResponse,
  TrustMetrics,
  VisibilitySummary,
} from "./types";

export { USE_MOCK };
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TIMEOUT_MS = 8000;

/** Mock file names in shared/mock/ (contract section 10), without ".json". */
export const MOCK_FILES = {
  health: "health",
  shopperQuestions: "shopper_questions",
  shopperRecommend: "shopper_recommend",
  products: "products",
  visibilitySummary: "visibility_summary",
  answers: "answers",
  sources: "sources",
  checkerRun: "checker_run",
  claims: "claims",
  incidents: "incidents",
  incidentDetail: "incident_detail",
  incidentApprove: "incident_approve",
  incidentReject: "incident_reject",
  incidentResolve: "incident_resolve",
  owners: "owners",
  audit: "audit",
  metricsTrust: "metrics_trust",
  report: "report",
  errorNotFound: "error_not_found",
  errorValidation: "error_validation",
  connectorQuery: "connector_query",
  connectorManifest: "connector_manifest",
} as const;

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

// GET /health
export function getHealth(): Promise<HealthResponse> {
  return request("GET", "/health", {}, undefined, MOCK_FILES.health);
}

// GET /api/v1/shopper/questions
export function getShopperQuestions(): Promise<ShopperQuestionsResponse> {
  return request("GET", "/api/v1/shopper/questions", {}, undefined, MOCK_FILES.shopperQuestions);
}

// POST /api/v1/shopper/recommend
export function recommend(body: RecommendRequest): Promise<RecommendResponse> {
  return request("POST", "/api/v1/shopper/recommend", {}, body, MOCK_FILES.shopperRecommend);
}

// GET /api/v1/products
export function getProducts(): Promise<ProductsResponse> {
  return request("GET", "/api/v1/products", {}, undefined, MOCK_FILES.products);
}

// GET /api/v1/visibility/summary?days=  (days: 1 to 30, default 30)
export function getVisibilitySummary(days?: number): Promise<VisibilitySummary> {
  return request("GET", "/api/v1/visibility/summary", { days }, undefined, MOCK_FILES.visibilitySummary);
}

// GET /api/v1/answers?assistantId=&limit=  (newest first)
export async function getAnswers(filters: AnswerFilters = {}): Promise<AnswersResponse> {
  const data = await request<AnswersResponse>("GET", "/api/v1/answers", { ...filters }, undefined, MOCK_FILES.answers);
  if (!USE_MOCK) return data;
  const { assistantId, limit = 50 } = filters;
  return { answers: data.answers.filter((a) => !assistantId || a.assistantId === assistantId).slice(0, limit) };
}

// GET /api/v1/sources?days=
export function getSources(days?: number): Promise<SourcesResponse> {
  return request("GET", "/api/v1/sources", { days }, undefined, MOCK_FILES.sources);
}

// POST /api/v1/checker/run
export function runChecker(body: CheckerRunRequest): Promise<CheckerRunResponse> {
  return request("POST", "/api/v1/checker/run", {}, body, MOCK_FILES.checkerRun);
}

// GET /api/v1/claims?status=&answerId=&limit=  (filters optional)
export async function getClaims(filters: ClaimFilters = {}): Promise<ClaimsResponse> {
  const data = await request<ClaimsResponse>("GET", "/api/v1/claims", { ...filters }, undefined, MOCK_FILES.claims);
  if (!USE_MOCK) return data;
  const { status, answerId, limit = 50 } = filters;
  return {
    claims: data.claims
      .filter((c) => !status || c.status === status)
      .filter((c) => !answerId || c.answerId === answerId)
      .slice(0, limit),
  };
}

// GET /api/v1/incidents?status=&severity=&limit=  (filters optional, newest first)
export async function getIncidents(filters: IncidentFilters = {}): Promise<IncidentsResponse> {
  const data = await request<IncidentsResponse>("GET", "/api/v1/incidents", { ...filters }, undefined, MOCK_FILES.incidents);
  if (!USE_MOCK) return data;
  const { status, severity, limit = 50 } = filters;
  return {
    incidents: data.incidents
      .filter((i) => !status || i.status === status)
      .filter((i) => !severity || i.severity === severity)
      .slice(0, limit),
  };
}

// GET /api/v1/incidents/{incidentId}
export function getIncident(incidentId: string): Promise<Incident> {
  return request("GET", `/api/v1/incidents/${encodeURIComponent(incidentId)}`, {}, undefined, MOCK_FILES.incidentDetail);
}

// POST /api/v1/incidents/{incidentId}/approve
export function approveIncident(incidentId: string, body: ApproveRequest): Promise<Incident> {
  return request("POST", `/api/v1/incidents/${encodeURIComponent(incidentId)}/approve`, {}, body, MOCK_FILES.incidentApprove);
}

// POST /api/v1/incidents/{incidentId}/reject
export function rejectIncident(incidentId: string, body: RejectRequest): Promise<Incident> {
  return request("POST", `/api/v1/incidents/${encodeURIComponent(incidentId)}/reject`, {}, body, MOCK_FILES.incidentReject);
}

// POST /api/v1/incidents/{incidentId}/resolve  (escalated incidents only)
export function resolveIncident(incidentId: string, body: ResolveRequest): Promise<Incident> {
  return request("POST", `/api/v1/incidents/${encodeURIComponent(incidentId)}/resolve`, {}, body, MOCK_FILES.incidentResolve);
}

// Open = pending_approval or escalated (contract v1.1, section 4).
export function isOpenIncident(incident: Incident): boolean {
  return incident.status === "pending_approval" || incident.status === "escalated";
}

/** The connector hasn't shipped and there is no shared/mock/connector_query.json to show instead. */
export class ConnectorUnavailableError extends Error {
  constructor() {
    super("The connector isn't available yet.");
    this.name = "ConnectorUnavailableError";
  }
}

export interface ConnectorResult {
  response: ConnectorQueryResponse;
  /** "mock" = example from shared/mock/ because the live connector hasn't shipped. Label it. */
  via: "live" | "mock";
}

// POST /api/v1/connector/query  (v1.1: what an AI assistant calls)
// Live first. If the backend hasn't shipped the connector yet (the manifest is also
// "not found"), falls back to shared/mock/connector_query.json and says so.
// A real "not found" (for example an unknown assistantId) is never hidden.
export async function connectorQuery(body: ConnectorQueryRequest): Promise<ConnectorResult> {
  if (USE_MOCK) return connectorMock();
  try {
    return { response: await request("POST", "/api/v1/connector/query", {}, body, MOCK_FILES.connectorQuery), via: "live" };
  } catch (error) {
    if (!(error instanceof ApiError && error.code === "NOT_FOUND") || (await connectorShipped())) throw error;
    return connectorMock();
  }
}

async function connectorMock(): Promise<ConnectorResult> {
  try {
    return { response: await readMock<ConnectorQueryResponse>(MOCK_FILES.connectorQuery), via: "mock" };
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") throw new ConnectorUnavailableError();
    throw error;
  }
}

// GET /api/v1/connector/manifest  (v1.1). Used only to tell whether the connector has shipped.
async function connectorShipped(): Promise<boolean> {
  try {
    await request("GET", "/api/v1/connector/manifest", {}, undefined, MOCK_FILES.connectorManifest);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") return false;
    throw error;
  }
}

// GET /api/v1/owners
export function getOwners(): Promise<OwnersResponse> {
  return request("GET", "/api/v1/owners", {}, undefined, MOCK_FILES.owners);
}

// GET /api/v1/audit?targetId=&limit=  (newest first, filter optional)
export async function getAudit(filters: AuditFilters = {}): Promise<AuditResponse> {
  const data = await request<AuditResponse>("GET", "/api/v1/audit", { ...filters }, undefined, MOCK_FILES.audit);
  if (!USE_MOCK) return data;
  const { targetId, limit = 50 } = filters;
  return { entries: data.entries.filter((e) => !targetId || e.targetId === targetId).slice(0, limit) };
}

// GET /api/v1/metrics/trust?days=  (`daily` has exactly `days` entries, oldest first)
export async function getTrustMetrics(days?: number): Promise<TrustMetrics> {
  const data = await request<TrustMetrics>("GET", "/api/v1/metrics/trust", { days }, undefined, MOCK_FILES.metricsTrust);
  if (USE_MOCK && days !== undefined) {
    return { ...data, periodDays: days, daily: data.daily.slice(-days) };
  }
  return data;
}

// GET /api/v1/report?days=
export function getReport(days?: number): Promise<Report> {
  return request("GET", "/api/v1/report", { days }, undefined, MOCK_FILES.report);
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

// In mock mode every call (GET or POST) returns its shared/mock/ file as-is.
async function request<T>(
  method: "GET" | "POST",
  path: string,
  query: Query,
  body: unknown,
  mockFile: string,
): Promise<T> {
  if (USE_MOCK) return readMock<T>(mockFile);
  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not set");
  }
  return readJson<T>(
    await fetchOrThrow(`${API_URL}${path}${toQueryString(query)}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    }),
  );
}

async function readMock<T>(mockFile: string): Promise<T> {
  return readJson<T>(await fetchOrThrow(`/mock/${mockFile}`));
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
