// data/lib/pick-lock.ts

/**
 * An event locks (no more picks accepted) at its known start_time, or —
 * for events scraped before that column existed — at 00:00 UTC on its date
 * as a conservative fallback. See the pick'em design doc's "Fenêtre de pick
 * & verrouillage" section.
 */
export function isEventLocked(event: { start_time: string | null; date: string }, now: Date): boolean {
  const lockAt = event.start_time ? new Date(event.start_time) : new Date(`${event.date}T00:00:00Z`);
  return now.getTime() >= lockAt.getTime();
}
