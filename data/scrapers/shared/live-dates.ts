// data/scrapers/shared/live-dates.ts
//
// Which event dates count as "live right now". Sherdog dates an event by its *local* day, but
// every workflow runs on UTC: a Saturday-night card in Las Vegas / Los Angeles (dated e.g.
// 2026-09-19) runs its main card well past 00:00 UTC, i.e. on 2026-09-20 UTC. Gating on the
// UTC date alone stopped the event-day polling halfway through UFC 331 and left its main card
// (Van vs. Pantoja 2 included) without results. So until noon UTC, yesterday's events are still
// considered live too — late enough for any American card to be over, early enough that a
// quiet day doesn't keep polling yesterday's event all day.
const LATE_CARD_CUTOFF_HOUR_UTC = 12;

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function liveEventDates(now: Date = new Date()): string[] {
  const dates = [isoDay(now)];
  if (now.getUTCHours() < LATE_CARD_CUTOFF_HOUR_UTC) {
    dates.push(isoDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  }
  return dates;
}

// Events dated in the last `days` days, *before* today (UTC) — the window in which the daily
// catch-up (rescrape-upcoming.ts, sync-live-fighter-history.ts --catch-up) still goes back for a
// past event whose results or fighters' histories never made it into the dataset.
export function isRecentPastDate(date: string, now: Date = new Date(), days = 30): boolean {
  const today = isoDay(now);
  const oldest = isoDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  return date < today && date >= oldest;
}
