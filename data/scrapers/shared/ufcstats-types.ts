// data/scrapers/shared/ufcstats-types.ts
import type { UfcStatsFightTotals, UfcStatsStrikeBreakdown } from '../parse-ufcstats';

// One row per fighter per fight (so a single UFCStats fight page produces two
// of these, one per corner) — snake_case fields to match the rest of this
// scraper's JSON output (see ScrapedFight/ScrapedFighter in ./types.ts).
export interface UfcStatsFightRecord {
  fighter_name: string;
  fighter_ufcstats_url: string;
  opponent_name: string;
  opponent_ufcstats_url: string;
  event_name: string;
  event_date: string; // ISO 'YYYY-MM-DD', or '' if UFCStats' date text didn't parse
  ufcstats_fight_url: string;
  result: 'win' | 'loss' | 'draw' | 'nc' | null;
  totals: UfcStatsFightTotals;
  strikes: UfcStatsStrikeBreakdown;
}
