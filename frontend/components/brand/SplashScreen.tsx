'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// Opening splash. Plays once per browser tab session, and can be replayed with ?splash=1 (handy for demos).
// Skips itself for people who prefer reduced motion. Click, tap or any key skips it.
// Mount it once, at the top of <body> in the root layout. Timing lives in styles/cirqo-splash.css.
const KEY = 'cirqo:splash:v1';
const TOTAL_MS = 1750, EXIT_MS = 260, SKIP_EXIT_MS = 180, WAIT_IMAGES_MS = 700;
type Phase = 'pending' | 'play' | 'exit' | 'gone';

export default function SplashScreen({ replayParam = 'splash' }: { replayParam?: string }) {
  const [phase, setPhase] = useState<Phase>('pending');
  const [sweep, setSweep] = useState(false);
  const mark = useRef<HTMLImageElement>(null);
  const word = useRef<HTMLImageElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finish = useRef<(fast: boolean) => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    const seen = (() => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } })();
    const force = new URLSearchParams(window.location.search).get(replayParam) === '1';
    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if ((seen && !force) || reduce) { document.documentElement.setAttribute('data-splash', 'done'); setPhase('gone'); return; }
    document.documentElement.removeAttribute('data-splash');
    try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode: it just plays again next time */ }
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const after = (fn: () => void, ms: number) => { timers.current.push(setTimeout(() => { if (!cancelled) fn(); }, ms)); };
    const end = () => { document.body.style.overflow = prevOverflow; document.documentElement.setAttribute('data-splash', 'done'); setPhase('gone'); };
    finish.current = (fast) => { timers.current.forEach(clearTimeout); timers.current = []; setPhase('exit'); after(end, fast ? SKIP_EXIT_MS : EXIT_MS); };
    const onKey = () => finish.current(true);
    window.addEventListener('keydown', onKey);
    // Wait for both images so the ring never starts on an empty frame; play anyway after a short timeout.
    const decoded = Promise.all([mark.current, word.current].map((i) => i?.decode?.().catch(() => undefined)));
    Promise.race([decoded, new Promise((r) => setTimeout(r, WAIT_IMAGES_MS))]).then(() => {
      if (cancelled) return;
      setSweep(typeof CSS !== 'undefined' && 'registerProperty' in CSS);   // the sweep needs @property; without it the ring simply spins and fades in
      setPhase('play');
      after(() => finish.current(false), TOTAL_MS - EXIT_MS);
    });
    return () => { cancelled = true; timers.current.forEach(clearTimeout); window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [replayParam]);

  if (phase === 'gone') return null;
  return (
    <div className="cq-splash" data-phase={phase} data-sweep={sweep ? '1' : '0'} aria-hidden="true" onClick={() => finish.current(true)}>
      <div className="cq-splash-lock">
        <Image ref={mark} className="cq-splash-mark" src="/brand/cirqo-mark.png" alt="" width={220} height={220} priority unoptimized draggable={false} />
        <Image ref={word} className="cq-splash-word" src="/brand/cirqo-wordmark.png" alt="" width={517} height={139} priority unoptimized draggable={false} />
        <span className="cq-splash-ping" />
      </div>
    </div>
  );
}
