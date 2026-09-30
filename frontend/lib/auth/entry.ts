// Every visit to the dashboard starts at the sign-in page (decision 59). The sign-in page sets this
// marker for the current tab when someone signs in or chooses the guest link; the dashboard layout
// refuses to render without it and sends the browser to /login. sessionStorage, so a new tab or a new
// browser session always asks again. Sign out clears it. A frontend gate, not security (decision 32).
const ENTRY_KEY = "cirqo:entered:v1";

export function markEntered(): void {
  try {
    sessionStorage.setItem(ENTRY_KEY, "1");
  } catch {
    // Blocked storage: the gate lets the page through rather than locking everyone out.
  }
}

export function clearEntered(): void {
  try {
    sessionStorage.removeItem(ENTRY_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True when this tab came through the sign-in page (or storage is blocked, see markEntered). */
export function hasEntered(): boolean {
  try {
    return sessionStorage.getItem(ENTRY_KEY) === "1";
  } catch {
    return true;
  }
}
