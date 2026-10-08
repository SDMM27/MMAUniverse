// data/lib/rating/prospect-rating.ts
//
// A UFC debutant's starting Glicko rating from what they did before the UFC.
// Every fighter used to start at initialRating (1500), whatever their record:
// an unbeaten Contender Series graduate and a 6-3 regional fighter looked
// the same to the rating until they had fought in the UFC.
//
// The prior is an Elo over every non-UFC bout in the Sherdog histories we
// scrape (fighter_fight_history: ~115k bouts, ~56k fighters, across every
// organization Sherdog lists, not only the ones we track), keyed by Sherdog
// URL. Beating opponents who themselves beat good opponents is what moves it,
// so no organization has to be ranked by hand. A debutant starts at
//
//   initialRating + scale * (Elo before their debut - 1500)
//
// so a fighter without known bouts still starts at initialRating. `scale` is
// tuned by `npm run tune:prospect`. Point in time: the Elo is replayed in date
// order and read strictly before the debut. Pure functions.

export type ExternalHistoryRow = {
  owner: string; // the history's fighter (Sherdog URL)
  opponent: string | null; // Sherdog URL; bouts without one can't be linked and are skipped
  eventName: string;
  date: string | null; // YYYY-MM-DD
  result: string; // 'win' | 'loss' | 'draw' | 'nc' from the owner's side
};

export type ExternalBout = { date: string; winner: string; loser: string };

// UFC bouts are the Glicko's own job (from UFCStats). Sherdog names them "UFC ..." (TUF finales included).
const isUfcEvent = (eventName: string) => /^UFC\b/i.test(eventName.trim());

/** Decided non-UFC bouts, each once (both fighters' histories list it), oldest first. */
export function collectExternalBouts(rows: ExternalHistoryRow[]): ExternalBout[] {
  const bouts = new Map<string, ExternalBout>();
  for (const row of rows) {
    if (!row.date || !row.opponent || row.opponent === row.owner || isUfcEvent(row.eventName)) continue;
    if (row.result !== 'win' && row.result !== 'loss') continue;
    const key = `${row.owner < row.opponent ? row.owner : row.opponent}|${row.owner < row.opponent ? row.opponent : row.owner}|${row.date}`;
    if (bouts.has(key)) continue;
    bouts.set(key, row.result === 'win' ? { date: row.date, winner: row.owner, loser: row.opponent } : { date: row.date, winner: row.opponent, loser: row.owner });
  }
  return Array.from(bouts.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.winner < b.winner ? -1 : 1));
}

export type ProspectElo = { rating: number; bouts: number };
export const PROSPECT_ELO_BASE = 1500;
export const DEFAULT_PROSPECT_K = 32;

/** K for a fighter's next bout: three times DEFAULT_PROSPECT_K at first, settling to it by their 10th bout. */
const kFactor = (k: number, boutsSoFar: number) => k * Math.max(1, 3 - boutsSoFar / 5);

/**
 * Replays the bouts in date order. The returned lookup gives a fighter's Elo
 * from every bout strictly before `beforeDate` (base and 0 bouts if none).
 */
export function simulateProspectElo(bouts: ExternalBout[], k = DEFAULT_PROSPECT_K): (key: string, beforeDate: string) => ProspectElo {
  const current = new Map<string, ProspectElo>();
  const snapshots = new Map<string, { date: string; elo: ProspectElo }[]>();
  const get = (key: string) => current.get(key) ?? { rating: PROSPECT_ELO_BASE, bouts: 0 };
  for (const bout of bouts) {
    const w = get(bout.winner);
    const l = get(bout.loser);
    const expected = 1 / (1 + Math.pow(10, (l.rating - w.rating) / 400));
    const after = {
      winner: { rating: w.rating + kFactor(k, w.bouts) * (1 - expected), bouts: w.bouts + 1 },
      loser: { rating: l.rating - kFactor(k, l.bouts) * (1 - expected), bouts: l.bouts + 1 },
    };
    for (const [key, elo] of [[bout.winner, after.winner], [bout.loser, after.loser]] as const) {
      current.set(key, elo);
      const list = snapshots.get(key) ?? [];
      list.push({ date: bout.date, elo });
      snapshots.set(key, list);
    }
  }
  return (key, beforeDate) => {
    const list = snapshots.get(key);
    if (!list) return { rating: PROSPECT_ELO_BASE, bouts: 0 };
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].date < beforeDate) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? { rating: PROSPECT_ELO_BASE, bouts: 0 } : list[lo - 1].elo;
  };
}

/** A debutant's starting Glicko rating from their pre-UFC Elo. */
export function prospectInitialRating(elo: ProspectElo, scale: number, initialRating: number): number {
  return initialRating + scale * (elo.rating - PROSPECT_ELO_BASE);
}
