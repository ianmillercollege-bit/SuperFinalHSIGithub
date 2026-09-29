"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopperOption } from "@/lib/types";

const SWIPE_DISTANCE = 90;

type Decision = { optionId: string; liked: boolean };

/**
 * One card per option. Swipe right (or press → / "Matters to me") = liked,
 * swipe left (or press ← / "Not important") = not liked.
 */
export default function SwipeDeck({
  options,
  onDone,
}: {
  options: ShopperOption[];
  onDone: (decisions: Decision[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | null>(null);
  const option = options[index];

  function decide(liked: boolean) {
    if (!option) return;
    const next = [...decisions, { optionId: option.optionId, liked }];
    setDecisions(next);
    setDragX(0);
    if (index + 1 < options.length) {
      setIndex(index + 1);
    } else {
      onDone(next);
    }
  }

  const decideRef = useRef(decide);
  useEffect(() => {
    decideRef.current = decide;
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") decideRef.current(true);
      if (event.key === "ArrowLeft") decideRef.current(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!option) return null;

  return (
    <div className="swipe">
      <p className="muted small">
        Card {index + 1} of {options.length}. Swipe right if it matters, left if not (or use the buttons or arrow keys).
      </p>
      <div
        className="swipe-card"
        style={{ transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)` }}
        onPointerDown={(event) => {
          dragStart.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStart.current !== null) setDragX(event.clientX - dragStart.current);
        }}
        onPointerUp={() => {
          dragStart.current = null;
          if (dragX > SWIPE_DISTANCE) decide(true);
          else if (dragX < -SWIPE_DISTANCE) decide(false);
          else setDragX(0);
        }}
      >
        {dragX > 30 && <span className="swipe-hint swipe-hint-yes">Matters</span>}
        {dragX < -30 && <span className="swipe-hint swipe-hint-no">Skip</span>}
        {option.label}
      </div>
      <div className="swipe-buttons">
        <button type="button" className="button button-secondary" onClick={() => decide(false)}>
          ← Not important
        </button>
        <button type="button" className="button" onClick={() => decide(true)}>
          Matters to me →
        </button>
      </div>
    </div>
  );
}
