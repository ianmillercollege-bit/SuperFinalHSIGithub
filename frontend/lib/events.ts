// Tells other parts of the page (like the sidebar badge) that incidents changed,
// e.g. after an approve, reject or resolve.
const INCIDENTS_CHANGED = "cirqo:incidents-changed";

export function notifyIncidentsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INCIDENTS_CHANGED));
}

export function onIncidentsChanged(callback: () => void): () => void {
  window.addEventListener(INCIDENTS_CHANGED, callback);
  return () => window.removeEventListener(INCIDENTS_CHANGED, callback);
}
