"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface AccountOption {
  name: string;
  role: string;
  username: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * The sign-in name field: type a name or username and the demo accounts that match are suggested, or open the
 * list with the arrow to see everyone. Same look as the other dropdowns (the .dd styles).
 * Keyboard: Arrow keys move, Enter picks (or submits the form when the list is closed), Escape closes.
 */
export default function AccountCombobox({
  id,
  value,
  onChange,
  onPick,
  accounts,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (account: AccountOption) => void;
  accounts: AccountOption[];
  invalid?: boolean;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Everyone shows while the box is empty or holds exactly one account's username; otherwise the matches show.
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || accounts.some((a) => a.username.toLowerCase() === q)) return accounts;
    return accounts.filter((a) => `${a.name} ${a.username} ${a.role}`.toLowerCase().includes(q));
  }, [accounts, value]);

  useEffect(() => {
    if (!open) return;
    const away = (event: Event) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("focusin", away);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(index: number) {
    const account = matches[index];
    if (account) onPick(account);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = matches.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActive(0);
        setOpen(true);
        return;
      }
      setActive((i) => Math.min(last, Math.max(0, i + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" && open && matches.length > 0) {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="dd dd-combo" ref={root}>
      <div className="dd-combo-box">
        <input
          id={id}
          className="cq-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && matches.length > 0 ? `${uid}-opt-${active}` : undefined}
          aria-invalid={invalid}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type a name or pick a demo account"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="dd-combo-toggle"
          tabIndex={-1}
          aria-label="Show demo accounts"
          aria-expanded={open}
          onClick={() => {
            setActive(0);
            setOpen((o) => !o);
          }}
        >
          <svg className="dd-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4.5 6 8.5 10 4.5" />
          </svg>
        </button>
      </div>
      {open && (
        <ul className="dd-list" role="listbox" id={listId} aria-label="Demo accounts" ref={list}>
          {matches.length === 0 && <li className="dd-empty">No demo account matches. You can still type a username.</li>}
          {matches.map((a, i) => (
            <li
              key={a.username}
              id={`${uid}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={`dd-option${i === active ? " is-active" : ""}${a.username.toLowerCase() === value.trim().toLowerCase() ? " is-selected" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
            >
              <span className="dd-avatar dd-avatar-sm" aria-hidden>
                {initials(a.name)}
              </span>
              <span className="dd-option-text">
                <span>{a.name}</span>
                <span className="dd-hint">{a.role}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
