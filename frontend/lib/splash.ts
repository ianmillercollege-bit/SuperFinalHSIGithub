// Small helpers for the opening splash. Import these from your own code (login handler, sign-out), never from a server component.
export const SPLASH_KEY = 'cirqo:splash:v1';   // must match the key in the layout's early <Script> (root layout)

// Call right before you navigate to the signed-in app, so the splash plays once for this login.
export function replaySplash(): void {
  try { sessionStorage.removeItem(SPLASH_KEY); } catch { /* private mode: it just plays */ }
  document.documentElement.removeAttribute('data-splash');
}
