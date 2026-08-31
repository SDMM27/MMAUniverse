// data/lib/pick-lock.ts

/**
 * An event locks (no more picks accepted) at the earliest known real start
 * time — `prelims_start` (the actual moment the broadcast starts, scraped
 * from ufc.com, see sync-ufc-broadcast-times.ts) when known, else the
 * coarser `start_time`, else — for events scraped before either column
 * existed — 00:00 UTC on its date as a conservative fallback. See the
 * pick'em design doc's "Fenêtre de pick & verrouillage" section.
 */
export function isEventLocked(
  event: { prelims_start?: string | null; start_time: string | null; date: string },
  now: Date,
): boolean {
  const lockAt = event.prelims_start
    ? new Date(event.prelims_start)
    : event.start_time
      ? new Date(event.start_time)
      : new Date(`${event.date}T00:00:00Z`);
  return now.getTime() >= lockAt.getTime();
}
