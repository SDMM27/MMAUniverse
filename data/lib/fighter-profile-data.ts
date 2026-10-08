// data/lib/fighter-profile-data.ts
//
// Extra fighter-page data: FightScore rating history and UFCStats per-fight
// rows. Ratings and fight stats are keyed by the UFC `fighters` row id, but a
// real fighter has one row per organization, so both queries run across every
// sibling id (resolveFighterIds).
import { sql } from './db';
import { resolveFighterIds } from './data';
import type { UfcFightStatsRow } from './career-stats';

export type RatingHistoryPoint = {
  id: number;
  weightClass: string;
  date: string; // YYYY-MM-DD
  opponentName: string;
  eventName: string;
  result: string | null;
  pointsBefore: number;
  pointsAfter: number;
};

export async function fetchFighterRatingHistory(fighterId: string): Promise<RatingHistoryPoint[]> {
  try {
    const fighterIds = await resolveFighterIds(fighterId);
    // event_date is a VARCHAR holding ISO 'YYYY-MM-DD' (sorts lexicographically,
    // same assumption as compute-fighter-ratings.ts); rows without one are skipped.
    const data = await sql<{
      id: number;
      weight_class: string;
      points_before: string;
      points_after: string;
      opponent_name: string;
      event_name: string;
      event_date: string;
      result: string | null;
    }>`
      SELECT frh.id, frh.weight_class, frh.points_before, frh.points_after,
             ffs.opponent_name, ffs.event_name, ffs.event_date, ffs.result
      FROM fighter_rating_history frh
      JOIN fighter_fight_stats ffs ON ffs.id = frh.fighter_fight_stats_id
      WHERE frh.fighter_id = ANY(${fighterIds}) AND ffs.event_date IS NOT NULL
      ORDER BY ffs.event_date ASC, frh.id ASC
    `;
    return data.rows
      .map((r) => ({
        id: r.id,
        weightClass: r.weight_class,
        date: r.event_date,
        opponentName: r.opponent_name,
        eventName: r.event_name,
        result: r.result,
        pointsBefore: Number(r.points_before),
        pointsAfter: Number(r.points_after),
      }))
      .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.pointsAfter));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter rating history.');
  }
}

export async function fetchFighterUfcFightStats(fighterId: string): Promise<UfcFightStatsRow[]> {
  try {
    const fighterIds = await resolveFighterIds(fighterId);
    // The opponent's row of the same fight (same ufcstats_fight_url, other
    // fighter_id) feeds strikes absorbed / takedown defense; LEFT JOIN LATERAL
    // ... LIMIT 1 keeps one row per fight even if a fuzzy match duplicated it.
    const data = await sql<{
      finish_round: number | null;
      finish_time: string | null;
      knockdowns: number;
      sig_strikes_landed: number;
      sig_strikes_attempted: number;
      takedowns_landed: number;
      takedowns_attempted: number;
      submission_attempts: number;
      control_time_seconds: number | null;
      sig_strikes_head_landed: number;
      sig_strikes_body_landed: number;
      sig_strikes_leg_landed: number;
      opp_found: boolean | null;
      opp_sig_strikes_landed: number | null;
      opp_takedowns_landed: number | null;
      opp_takedowns_attempted: number | null;
    }>`
      SELECT ffs.finish_round, ffs.finish_time, ffs.knockdowns,
             ffs.sig_strikes_landed, ffs.sig_strikes_attempted,
             ffs.takedowns_landed, ffs.takedowns_attempted, ffs.submission_attempts,
             ffs.control_time_seconds,
             ffs.sig_strikes_head_landed, ffs.sig_strikes_body_landed, ffs.sig_strikes_leg_landed,
             opp.found AS opp_found, opp.sig_strikes_landed AS opp_sig_strikes_landed,
             opp.takedowns_landed AS opp_takedowns_landed, opp.takedowns_attempted AS opp_takedowns_attempted
      FROM fighter_fight_stats ffs
      LEFT JOIN LATERAL (
        SELECT true AS found, o.sig_strikes_landed, o.takedowns_landed, o.takedowns_attempted
        FROM fighter_fight_stats o
        WHERE o.ufcstats_fight_url = ffs.ufcstats_fight_url AND o.fighter_id <> ffs.fighter_id
        LIMIT 1
      ) opp ON true
      WHERE ffs.fighter_id = ANY(${fighterIds})
    `;
    return data.rows.map((r) => ({
      finishRound: r.finish_round,
      finishTime: r.finish_time,
      knockdowns: r.knockdowns,
      sigStrikesLanded: r.sig_strikes_landed,
      sigStrikesAttempted: r.sig_strikes_attempted,
      takedownsLanded: r.takedowns_landed,
      takedownsAttempted: r.takedowns_attempted,
      submissionAttempts: r.submission_attempts,
      controlTimeSeconds: r.control_time_seconds,
      headLanded: r.sig_strikes_head_landed,
      bodyLanded: r.sig_strikes_body_landed,
      legLanded: r.sig_strikes_leg_landed,
      opponent: r.opp_found
        ? {
            sigStrikesLanded: r.opp_sig_strikes_landed ?? 0,
            takedownsLanded: r.opp_takedowns_landed ?? 0,
            takedownsAttempted: r.opp_takedowns_attempted ?? 0,
          }
        : null,
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter UFC stats.');
  }
}
