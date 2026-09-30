"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "cirqo.theme";

/** Night / light mode switch. The choice is kept in this browser; the first visit follows the system setting. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // The page script in app/layout.tsx has already set data-theme, so this only reads it.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage: the choice lasts until the page is closed.
    }
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={dark} onClick={toggle} disabled={theme === null}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dark ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      {dark ? "Night mode" : "Light mode"}
    </button>
  );
}
