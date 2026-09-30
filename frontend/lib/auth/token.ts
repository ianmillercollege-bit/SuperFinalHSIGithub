// The login token from POST /api/v1/auth/login (contract v1.4, section 7c), kept in this browser only.
// While it is present every API call sends it as `Authorization: Bearer <token>`; the backend then scopes
// the dashboard to the token's brand. It is absent for guests and for the local sample sign-in.
const KEY = "cirqo.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // Blocked storage: the sign-in still works for this page load.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
