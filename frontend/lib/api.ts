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

import { brandScope, signOutBrand } from "./auth/brandSession";
import { clearToken, getToken } from "./auth/token";
import { resetUserSession } from "./auth/userSession";
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
  BrandProfile,
  ClaimCompanyRequest,
  ClaimCompanyResponse,
  BrandsResponse,
  ConnectorQueryRequest,
  ConnectorSearchRequest,
  ConnectorSearchResponse,
  LoginRequest,
  LoginResponse,
  DemoAccountsResponse,
  OnboardRequest,
  OnboardResponse,
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

const TIMEOUT_MS = 20000;
/** The connector is the first call a visitor makes; a sleeping Render backend can take about a minute to wake. */
const CONNECTOR_TIMEOUT_MS = 60000;

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
  /** v1.3. No file in shared/mock/ yet; mock mode falls back to the contract example on screen. */
  demoAccounts: "demo_accounts",
  /** v1.4. No file in shared/mock/, so mock mode reports NOT_FOUND. */
  authLogin: "auth_login",
  brandProfile: "brand_profile",
  claimCompany: "claim_company",
  brands: "brands",
  connectorSearch: "connector_search",
  brandsOnboard: "brands_onboard",
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

// GET /api/v1/products?category=&brandId=  (both optional; v1.4.1 filters, older backends ignore them)
export function getProducts(filters: { category?: string; brandId?: string } = {}): Promise<ProductsResponse> {
  return request("GET", "/api/v1/products", { ...filters }, undefined, MOCK_FILES.products);
}

// GET /api/v1/brands/{brandId}  (v1.4: the company profile)
export function getBrand(brandId: string): Promise<BrandProfile> {
  return request("GET", `/api/v1/brands/${encodeURIComponent(brandId)}`, {}, undefined, MOCK_FILES.brandProfile);
}

// POST /api/v1/brands/{brandId}/claim  (v1.5: a not-opted-in company opts in; 409 CONFLICT if it already has)
export function claimCompany(brandId: string, body: ClaimCompanyRequest): Promise<ClaimCompanyResponse> {
  return request("POST", `/api/v1/brands/${encodeURIComponent(brandId)}/claim`, {}, body, MOCK_FILES.claimCompany);
}

// GET /api/v1/brands  (v1.4, CIRQO Staff token only: 403 FORBIDDEN otherwise)
export function getBrands(): Promise<BrandsResponse> {
  return request("GET", "/api/v1/brands", {}, undefined, MOCK_FILES.brands);
}

// POST /api/v1/connector/search  (v1.4: the funnel; up to 5 options and narrowing questions)
export function connectorSearch(body: ConnectorSearchRequest): Promise<ConnectorSearchResponse> {
  return request("POST", "/api/v1/connector/search", {}, body, MOCK_FILES.connectorSearch, CONNECTOR_TIMEOUT_MS);
}

// GET /api/v1/visibility/summary?days=  (days: 1 to 30, default 30)
export function getVisibilitySummary(days?: number): Promise<VisibilitySummary> {
  return cached(`summary:${days ?? ""}`, () => request("GET", "/api/v1/visibility/summary", { days }, undefined, MOCK_FILES.visibilitySummary));
}

// GET /api/v1/answers?assistantId=&limit=  (newest first)
export async function getAnswers(filters: AnswerFilters = {}): Promise<AnswersResponse> {
  const data = await cached(`answers:${JSON.stringify(filters)}`, () =>
    request<AnswersResponse>("GET", "/api/v1/answers", { ...filters }, undefined, MOCK_FILES.answers),
  );
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

export interface ConnectorResult {
  response: ConnectorQueryResponse;
  /** "mock" = example from shared/mock/ (mock mode is on). Label it on screen. */
  via: "live" | "mock";
}

// POST /api/v1/connector/query  (v1.1: what an AI assistant calls)
// Always live, unless mock mode is on (NEXT_PUBLIC_USE_MOCK=true), which reads
// shared/mock/connector_query.json. Errors keep the contract's codes (404 unknown
// assistantId, 422 bad useCase / mustHave / maxPrice / missing assistantId); nothing is hidden.
export async function connectorQuery(body: ConnectorQueryRequest): Promise<ConnectorResult> {
  if (USE_MOCK) {
    return { response: await readMock<ConnectorQueryResponse>(MOCK_FILES.connectorQuery), via: "mock" };
  }
  const response = await request<ConnectorQueryResponse>(
    "POST",
    "/api/v1/connector/query",
    {},
    withoutEmptyConstraints(body),
    MOCK_FILES.connectorQuery,
    CONNECTOR_TIMEOUT_MS,
  );
  return { response, via: "live" };
}

// Optional constraint fields that are empty are left out of the request; if none are
// left, `constraints` is left out too (the contract makes all of them optional).
function withoutEmptyConstraints(body: ConnectorQueryRequest): ConnectorQueryRequest {
  const { maxPrice, useCase, mustHave } = body.constraints ?? {};
  const constraints: NonNullable<ConnectorQueryRequest["constraints"]> = {};
  if (typeof maxPrice === "number" && Number.isFinite(maxPrice)) constraints.maxPrice = maxPrice;
  if (useCase) constraints.useCase = useCase;
  if (mustHave && mustHave.length > 0) constraints.mustHave = mustHave;
  const { constraints: _dropped, ...rest } = body;
  return Object.keys(constraints).length > 0 ? { ...rest, constraints } : rest;
}

// GET /api/v1/auth/demo-accounts  (v1.3: the demo logins; no auth)
export function getDemoAccounts(): Promise<DemoAccountsResponse> {
  return request("GET", "/api/v1/auth/demo-accounts", {}, undefined, MOCK_FILES.demoAccounts);
}

// POST /api/v1/auth/login  (v1.4). 401 UNAUTHORIZED "Wrong username or password." for either mistake.
export function login(body: LoginRequest): Promise<LoginResponse> {
  return request("POST", "/api/v1/auth/login", {}, body, MOCK_FILES.authLogin);
}

// POST /api/v1/auth/logout  (v1.4). Best effort: the browser forgets the token either way.
export function logoutRequest(): Promise<{ ok: boolean }> {
  return request("POST", "/api/v1/auth/logout", {}, {}, MOCK_FILES.authLogin);
}

// POST /api/v1/brands/onboard  (v1.3: "Connect your catalog"). 201 on success; 409 CONFLICT for a
// duplicate brand name; 422 VALIDATION_ERROR. Nothing is stored in mock mode, so it always fails there.
export function onboardBrand(body: OnboardRequest): Promise<OnboardResponse> {
  return request("POST", "/api/v1/brands/onboard", {}, body, MOCK_FILES.brandsOnboard);
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
  timeoutMs: number = TIMEOUT_MS,
): Promise<T> {
  if (USE_MOCK) return readMock<T>(mockFile);
  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not set");
  }
  const hadToken = getToken() !== null;
  try {
    return await readJson<T>(
      await fetchOrThrow(`${API_URL}${path}${toQueryString(withBrand(path, query))}`, {
        method,
        headers: requestHeaders(body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      }, timeoutMs),
    );
  } catch (error) {
    // A 401 while signed in means the token ended (tokens die when the demo server restarts). Drop back to the
    // guest path so the app keeps working, and say so.
    if (hadToken && path !== "/api/v1/auth/login" && error instanceof ApiError && error.code === "UNAUTHORIZED") {
      clearToken();
      signOutBrand();
      resetUserSession();
      throw new ApiError("Your sign-in ended (the demo server restarted). You are now a guest. Sign in again to continue.", "UNAUTHORIZED", error.status);
    }
    throw error;
  }
}

// Contract v1.3, section 7b: these dashboard endpoints accept `brandId`. With no account chosen
// nothing is added and the backend answers for the default brand (brand_001), as before.
const BRAND_SCOPED_PATHS = [
  "/api/v1/visibility/summary",
  "/api/v1/answers",
  "/api/v1/sources",
  "/api/v1/claims",
  "/api/v1/incidents",
  "/api/v1/owners",
  "/api/v1/audit",
  "/api/v1/metrics/trust",
  "/api/v1/report",
];

// The demo backend needs several seconds for the summary and answers. Pages share one recent copy (and one
// request in flight) so moving between pages is instant. A failed request is never kept.
const CACHE_MS = 60000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const full = `${brandScope() ?? ""}|${getToken() ? "in" : "out"}|${key}`;
  const hit = cache.get(full);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(full, { at: Date.now(), value });
  value.catch(() => cache.delete(full));
  return value;
}

function withBrand(path: string, query: Query): Query {
  const brandId = brandScope();
  if (!brandId || query.brandId !== undefined || !BRAND_SCOPED_PATHS.includes(path)) return query;
  return { ...query, brandId };
}

function requestHeaders(hasBody: boolean): Record<string, string> | undefined {
  const token = getToken();
  if (!hasBody && !token) return undefined;
  return { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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

// The contract's error codes (BACKEND_CONTRACT.md section 2). Any other code is not treated as a contract error.
const ERROR_CODES: readonly string[] = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
];

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  const error = (body as ApiErrorBody | null)?.error;
  return typeof error?.code === "string" && ERROR_CODES.includes(error.code) && typeof error?.message === "string";
}

async function fetchOrThrow(url: string, init: RequestInit = {}, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init, timeoutMs);
  } catch {
    throw new ApiError("Could not reach the backend");
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
