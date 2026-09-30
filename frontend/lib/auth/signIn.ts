// Sign-in for /login: username and password (DECISIONS.md #33, contract v1.4 section 7c).
//
// 1. Try POST /api/v1/auth/login. On success the token is kept and the session is filled from the response.
// 2. If the backend has not shipped login yet (NOT_FOUND), check the demo accounts in lib/auth/demoAccounts.ts
//    in this browser instead. That path is labeled on the login page as not real authentication.
// A wrong username or password always gives the contract's single neutral message.
import { ApiError, login, logoutRequest } from "../api";
import { BUSINESS } from "../business";
import { describeError } from "../errors";
import { DEMO_LOGINS, DEMO_PASSWORD } from "./demoAccounts";
import { signInAs, signOutBrand } from "./brandSession";
import { clearToken, getToken, setToken } from "./token";
import { resetUserSession, signInUser } from "./userSession";

export const WRONG_LOGIN = "Wrong username or password.";

// The default demo brand and its demo key (contract v1.3 section 7b), used when the sign-in is checked locally.
const DEFAULT_BRAND = { brandId: BUSINESS.id, brandName: BUSINESS.name, role: "owner" as const, apiKey: "fd_demo_owner_2026" };

export async function signInWithPassword(username: string, password: string): Promise<{ error?: string; local?: boolean }> {
  try {
    const result = await login({ username, password });
    setToken(result.token);
    signInUser({ name: result.user.name, role: result.user.role === "Viewer" ? "viewer" : "owner", title: result.user.role });
    if (result.brand) signInAs({ brandId: result.brand.brandId, brandName: result.brand.brandName, role: result.user.role === "Viewer" ? "viewer" : "owner", apiKey: "" });
    else signOutBrand();
    return {};
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHORIZED") return { error: WRONG_LOGIN };
    if (!(error instanceof ApiError && error.code === "NOT_FOUND")) return { error: describeError(error) };
  }

  // Backend login not deployed yet: check the sample accounts here.
  const account = DEMO_LOGINS.find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
  if (!account || password !== DEMO_PASSWORD) return { error: WRONG_LOGIN };
  clearToken();
  signInUser({ name: account.name, role: "owner", title: account.role });
  signInAs(DEFAULT_BRAND);
  return { local: true };
}

/** "Continue as guest": no account, so the app behaves as on a first visit. */
export function continueAsGuest(): void {
  clearToken();
  signOutBrand();
  resetUserSession();
}

/** Sign out: forget the token (telling the backend when there is one) and mark the browser signed out. */
export function forgetLogin(): void {
  if (getToken()) void logoutRequest().catch(() => undefined);
  clearToken();
}
