// data/scrapers/shared/ufcstats-types.ts
import type { UfcStatsFightTotals, UfcStatsStrikeBreakdown, UfcStatsRoundStats } from '../parse-ufcstats';

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
  // Fight-level facts (same for both fighter_name and opponent_name's rows of
  // the same fight) -- added for the FightScore rating engine, see
  // docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md.
  weight_class: string;
  method: string;
  round: number; // the round the fight ended in (decisions: the last round)
  time: string;
  scheduled_rounds: number;
  totals: UfcStatsFightTotals;
  strikes: UfcStatsStrikeBreakdown;
  rounds: UfcStatsRoundStats[]; // one entry per round actually fought, for fighter_name's side
}
