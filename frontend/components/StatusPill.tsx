import type { Tone } from "@/lib/tones";

// Always includes text, so meaning never depends on color alone.
export default function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
