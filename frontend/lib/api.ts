// The single place where the frontend talks to the backend.
//
// Pages never call fetch() directly. They call the helpers below, so the
// backend address and the mock-data switch are handled in one spot.
//
// Settings (read at build time, so restart `npm run dev` after changing them):
//   NEXT_PUBLIC_API_URL   Backend address, e.g. https://frontdoor-api.onrender.com
//   NEXT_PUBLIC_USE_MOCK  "true" = load example data from shared/mock/ instead
//                         of the live backend. Anything else = live backend.
//
// Endpoint paths and response shapes come from BACKEND_CONTRACT.md. Do not add
// endpoints here that are not in the contract.
//
// These helpers are meant to be called from the browser (client components).

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const TIMEOUT_MS = 8000;

type RequestOptions = {
  // Name of the example file in shared/mock/ (without ".json") to use when
  // mock mode is on, e.g. { mockFile: "some_endpoint" }.
  mockFile?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("POST", path, body, options);
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

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  { mockFile }: RequestOptions,
): Promise<T> {
  if (USE_MOCK) {
    if (!mockFile) {
      throw new ApiError(`Mock mode is on but no mockFile was given for ${method} ${path}`);
    }
    return readJson<T>(await fetchWithTimeout(`/mock/${encodeURIComponent(mockFile)}`));
  }

  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not set");
  }

  const res = await fetchWithTimeout(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return readJson<T>(res);
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as T;
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
