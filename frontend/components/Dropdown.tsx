"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
  /** A second, smaller line under the label. */
  hint?: string;
  /** Initials shown in a circle before the label. */
  avatar?: string;
}

/**
 * A styled dropdown that replaces the browser's <select> (whose open list cannot be styled).
 * Keyboard: Arrow keys move, Home/End jump, Enter or Space picks, Escape closes, typing jumps to a match.
 * It follows the select-only combobox pattern, so screen readers announce it as a dropdown list.
 */
export default function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  compact,
  showAvatar,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  /** A shorter trigger, for filters. */
  compact?: boolean;
  /** Show the selected option's avatar in the trigger. */
  showAvatar?: boolean;
  /** Keep the label for screen readers only, when the page already shows it. */
  hideLabel?: boolean;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  // Fixed coordinates from the trigger, so a scrolling table or card around it can never clip the open list.
  const [place, setPlace] = useState<React.CSSProperties>({});

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function show() {
    if (disabled || options.length === 0) return;
    const trigger = root.current?.querySelector("button")?.getBoundingClientRect();
    if (trigger) {
      const below = window.innerHeight - trigger.bottom;
      const flip = below < 280 && trigger.top > below;
      setUp(flip);
      const room = Math.max(120, (flip ? trigger.top : below) - 14);
      setPlace({
        position: "fixed",
        left: "auto",
        right: Math.max(8, window.innerWidth - trigger.right),
        minWidth: trigger.width,
        maxHeight: Math.min(264, room),
        ...(flip ? { top: "auto", bottom: window.innerHeight - trigger.top + 6 } : { top: trigger.bottom + 6, bottom: "auto" }),
      });
    }
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function pick(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  // Close on a click or focus outside.
  useEffect(() => {
    if (!open) return;
    const away = (event: Event) => {
      const inside = root.current?.contains(event.target as Node) || list.current?.contains(event.target as Node);
      if (!inside) setOpen(false);
    };
    // The fixed list would drift from its trigger if the page moved under it, so any outside scroll or resize closes it.
    const moved = (event: Event) => {
      if (event.type === "scroll" && list.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("focusin", away);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("focusin", away);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(event: React.KeyboardEvent) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return show();
        setActive((i) => Math.min(last, Math.max(0, i + (event.key === "ArrowDown" ? 1 : -1))));
        return;
      }
      case "Home":
      case "End":
        if (open) {
          event.preventDefault();
          setActive(event.key === "Home" ? 0 : last);
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) pick(active);
        else show();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = Date.now();
        typed.current = { text: (now - typed.current.at > 700 ? "" : typed.current.text) + event.key.toLowerCase(), at: now };
        const from = open ? active + 1 : 0;
        const ordered = [...options.slice(from), ...options.slice(0, from)];
        const hit = ordered.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
        if (hit) {
          const index = options.indexOf(hit);
          if (open) setActive(index);
          else onChange(hit.value);
        }
      }
    }
  }

  return (
    <div className={`dd${compact ? " dd-compact" : ""}`} ref={root}>
      <span className={hideLabel ? "visually-hidden" : "dd-label"} id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="dd-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {showAvatar && (
          <span className="dd-avatar" aria-hidden>
            {selected?.avatar ?? "…"}
          </span>
        )}
        <span className={`dd-value${selected ? "" : " is-placeholder"}`}>{selected ? selected.label : placeholder}</span>
        <svg className="dd-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4.5 6 8.5 10 4.5" />
        </svg>
      </button>
      {open &&
        createPortal(
        // Rendered at the top of the page so no card, table or transformed row around the trigger can hide or offset it.
        <ul className={`dd-list${up ? " is-up" : ""}`} role="listbox" id={listId} aria-labelledby={labelId} ref={list} style={place}>
          {options.map((o, i) => (
            <li
              key={o.value || `empty-${i}`}
              id={`${uid}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              className={`dd-option${i === active ? " is-active" : ""}${o.value === value ? " is-selected" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
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
              {o.value === value && (
                <svg className="dd-check" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6.5 5 9.5 10 3" />
                </svg>
              )}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
