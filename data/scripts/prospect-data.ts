// data/scripts/prospect-data.ts
//
// The pre-UFC prior's inputs, from Neon: every Sherdog history row
// (fighter_fight_history), keyed by Sherdog URL, and each fighter id's
// Sherdog URL (see data/lib/rating/prospect-rating.ts). Shared by
// compute-fighter-ratings (the shipped ratings) and every script that
// replays the Glicko, so they all rate the same way. Read-only.
import { neon } from '@neondatabase/serverless';
import { DEFAULT_GLICKO_PARAMS } from '../lib/rating/glicko-rating';
import { PROSPECT_PARAMS, prospectInitialRatings, type ExternalHistoryRow, type ProspectParams } from '../lib/rating/prospect-rating';
import { loadEnvLocal } from './tuning-data';

export async function loadExternalHistory(): Promise<{ rows: ExternalHistoryRow[]; sherdogUrlOf: Map<number, string> }> {
  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  console.log('Loading fighter_fight_history + fighters.sherdog_url from Neon...');
  const history = (await sql`
    SELECT f.sherdog_url AS owner, h.opponent_sherdog_url AS opponent, h.event_name, h.event_date, h.result
    FROM fighter_fight_history h JOIN fighters f ON f.id = h.fighter_id
    WHERE f.sherdog_url IS NOT NULL
  `) as { owner: string; opponent: string | null; event_name: string; event_date: string | null; result: string }[];
  const fighters = (await sql`SELECT id, sherdog_url FROM fighters WHERE sherdog_url IS NOT NULL`) as { id: number; sherdog_url: string }[];
  return {
    rows: history.map((h) => ({ owner: h.owner, opponent: h.opponent, eventName: h.event_name, date: h.event_date, result: h.result })),
    sherdogUrlOf: new Map(fighters.map((f) => [f.id, f.sherdog_url])),
  };
}

/** The shipped debutant starting ratings, ready for simulateCareerRatings. */
export async function loadProspectPrior(params: ProspectParams = PROSPECT_PARAMS, initialRating = DEFAULT_GLICKO_PARAMS.initialRating) {
  const { rows, sherdogUrlOf } = await loadExternalHistory();
  return prospectInitialRatings(rows, sherdogUrlOf, initialRating, params);
}
