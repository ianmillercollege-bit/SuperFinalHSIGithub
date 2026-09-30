"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DropdownOption } from "@/components/Dropdown";

/** Words that start with the typed text come first, then words that only contain it. */
export function matchOptions(options: DropdownOption[], text: string): DropdownOption[] {
  const q = text.trim().toLowerCase();
  if (!q) return options;
  const starts = options.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = options.filter((o) => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q));
  return [...starts, ...contains];
}

/** The option the text means: an exact match, else the only option that matches. */
export function resolveOption(options: DropdownOption[], text: string): DropdownOption | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;
  const exact = options.find((o) => o.label.toLowerCase() === q);
  if (exact) return exact;
  const matches = matchOptions(options, text);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * A type-to-search field: you type, matching names appear, and Enter or Tab completes the top match.
 * It follows the editable combobox pattern, so screen readers announce it as a field with suggestions.
 */
export default function Autocomplete({
  label,
  text,
  onText,
  options,
  placeholder,
  disabled,
  error,
  autoFocus,
}: {
  label: string;
  text: string;
  onText: (text: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  /** A message shown under the field (announced to screen readers). */
  error?: string;
  autoFocus?: boolean;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => matchOptions(options, text), [options, text]);
  const chosen = resolveOption(options, text);
  const exact = options.find((o) => o.label.toLowerCase() === text.trim().toLowerCase());

  useEffect(() => setActive(0), [text]);

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

  function complete(option: DropdownOption) {
    onText(option.label);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const showing = open && matches.length > 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => (event.key === "ArrowDown" ? Math.min(matches.length - 1, i + 1) : Math.max(0, i - 1)));
    } else if (event.key === "Enter" && showing && !exact) {
      // First Enter completes the suggestion; once the name is complete, Enter submits the form.
      event.preventDefault();
      complete(matches[active] ?? matches[0]);
    } else if (event.key === "Tab" && showing && !exact && text.trim()) {
      complete(matches[active] ?? matches[0]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className="dd ac"
      ref={root}
      onBlur={(event) => {
        // Tabbing to another field closes this list (a click elsewhere is handled by the mousedown listener).
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="dd-label" htmlFor={`${uid}-input`}>
        {label}
      </label>
      <div className={`ac-box${error ? " has-error" : ""}`}>
        <span className="dd-avatar" aria-hidden>
          {chosen?.avatar ?? "?"}
        </span>
        <input
          id={`${uid}-input`}
          className="ac-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && matches.length > 0 ? `${uid}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            onText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {error && (
        <p className="ac-error" id={`${uid}-error`} role="alert">
          {error}
        </p>
      )}
      {open && matches.length > 0 && (
        <ul className="dd-list" role="listbox" id={listId} aria-label={`${label} suggestions`}>
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`dd-option${i === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => complete(o)}
            >
              {o.avatar && (
                <span className="dd-avatar dd-avatar-sm" aria-hidden>
                  {o.avatar}
                </span>
              )}
              <span className="dd-option-text">
                <span>{o.label}</span>
                {o.hint && <span className="dd-hint">{o.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
