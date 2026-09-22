// data/lib/rating/simulate-career.ts
//
// Walks EVERY UFC fight (all weight classes) in one chronological pass,
// building each fighter's single Glicko rating (./glicko-rating.ts) -- see
// docs/superpowers/specs/2026-09-22-fightscore-glicko-design.md. Unlike
// simulateDivisionRatings (still used to feed the win predictor), a fighter
// keeps their rating when they change weight class: it is carried over
// (carryOverShare) with extra uncertainty (rdOnDivisionChange). Pure
// function: the caller fetches, tags each fight with its division and sorts.
import { computeDominanceScore } from './dominance-score';
import { applyDivisionChange, rdAfterInactivity, updateGlicko, winnerOutcomeScore, DEFAULT_GLICKO_PARAMS, type GlickoParams, type GlickoRating } from './glicko-rating';
import { monthsBetween, type DivisionFightInput, type DivisionNoResultInput } from './simulate-division';

export type CareerFightInput = DivisionFightInput & { division: string };
export type CareerNoResultInput = DivisionNoResultInput & { division: string };

export type CareerFighterState = {
  rating: number;
  rd: number; // as of lastFightDate -- see ratingAsOf for "today"
  lastFightDate: string | null;
  lastDivision: string | null;
  ufcFights: number; // decided bouts only (wins + losses)
  lastFightDateByDivision: Map<string, string>; // no contests/draws included, for ranking eligibility
};

export type CareerHistoryEntry = {
  fightUrl: string;
  eventDate: string;
  division: string;
  isTitleFight: boolean;
  winnerId: number;
  loserId: number;
  dominanceScore: number;
  dominanceEstimated: boolean;
  // Pre-fight values after inactivity and division-change adjustments -- what the update actually used, and what tuning predicts from.
  winnerBefore: GlickoRating;
  loserBefore: GlickoRating;
  winnerAfter: GlickoRating;
  loserAfter: GlickoRating;
  winnerChangedDivision: boolean;
  loserChangedDivision: boolean;
  winnerUfcFightsBefore: number;
  loserUfcFightsBefore: number;
};

export type CareerSimulationResult = {
  fighterStates: Map<number, CareerFighterState>;
  history: CareerHistoryEntry[];
};

/** A fighter's rating as of `asOfDateIso`: same rating, RD grown for the inactivity since their last bout. */
export function ratingAsOf(state: CareerFighterState, asOfDateIso: string, params: GlickoParams = DEFAULT_GLICKO_PARAMS): GlickoRating {
  return { rating: state.rating, rd: rdAfterInactivity(state.rd, monthsBetween(state.lastFightDate, asOfDateIso), params) };
}

/**
 * `fights` and `noResults` must each be sorted oldest-first. A no result is
 * applied before any fight strictly later than it; it moves no rating but
 * counts as activity (and as a bout in its division) for fighters already
 * rated -- same convention as simulateDivisionRatings.
 */
export function simulateCareerRatings(
  fights: CareerFightInput[],
  noResults: CareerNoResultInput[] = [],
  params: GlickoParams = DEFAULT_GLICKO_PARAMS,
): CareerSimulationResult {
  const states = new Map<number, CareerFighterState>();
  const history: CareerHistoryEntry[] = [];
  let nextNoResult = 0;

  const getState = (fighterId: number): CareerFighterState => {
    let state = states.get(fighterId);
    if (!state) {
      state = { rating: params.initialRating, rd: params.initialRd, lastFightDate: null, lastDivision: null, ufcFights: 0, lastFightDateByDivision: new Map() };
      states.set(fighterId, state);
    }
    return state;
  };

  // Brings a fighter to fight time in `division`: inactivity, then a division change if any. Returns whether they changed division.
  const prepare = (state: CareerFighterState, division: string, dateIso: string): boolean => {
    state.rd = rdAfterInactivity(state.rd, monthsBetween(state.lastFightDate, dateIso), params);
    const changed = state.lastDivision !== null && state.lastDivision !== division;
    if (changed) Object.assign(state, applyDivisionChange(state, params));
    return changed;
  };

  const markBout = (state: CareerFighterState, division: string, dateIso: string) => {
    state.lastFightDate = dateIso;
    state.lastDivision = division;
    state.lastFightDateByDivision.set(division, dateIso);
  };

  const applyNoResultsBefore = (dateIso: string | null) => {
    while (nextNoResult < noResults.length && (dateIso === null || noResults[nextNoResult].eventDate < dateIso)) {
      const noResult = noResults[nextNoResult++];
      for (const fighterId of noResult.fighterIds) {
        const state = states.get(fighterId);
        if (!state) continue;
        prepare(state, noResult.division, noResult.eventDate);
        markBout(state, noResult.division, noResult.eventDate);
      }
    }
  };

  for (const fight of fights) {
    applyNoResultsBefore(fight.eventDate);
    const winner = getState(fight.winnerId);
    const loser = getState(fight.loserId);
    const winnerChangedDivision = prepare(winner, fight.division, fight.eventDate);
    const loserChangedDivision = prepare(loser, fight.division, fight.eventDate);
    const winnerBefore = { rating: winner.rating, rd: winner.rd };
    const loserBefore = { rating: loser.rating, rd: loser.rd };

    const dominance = computeDominanceScore(fight.winnerSide, fight.loserSide);
    const score = winnerOutcomeScore(dominance.score, params);
    const winnerAfter = updateGlicko(winnerBefore, loserBefore, score, params);
    const loserAfter = updateGlicko(loserBefore, winnerBefore, 1 - score, params);

    history.push({
      fightUrl: fight.fightUrl,
      eventDate: fight.eventDate,
      division: fight.division,
      isTitleFight: fight.isTitleFight,
      winnerId: fight.winnerId,
      loserId: fight.loserId,
      dominanceScore: dominance.score,
      dominanceEstimated: dominance.estimated,
      winnerBefore,
      loserBefore,
      winnerAfter,
      loserAfter,
      winnerChangedDivision,
      loserChangedDivision,
      winnerUfcFightsBefore: winner.ufcFights,
      loserUfcFightsBefore: loser.ufcFights,
    });

    Object.assign(winner, winnerAfter);
    Object.assign(loser, loserAfter);
    winner.ufcFights += 1;
    loser.ufcFights += 1;
    markBout(winner, fight.division, fight.eventDate);
    markBout(loser, fight.division, fight.eventDate);
  }

  applyNoResultsBefore(null);
  return { fighterStates: states, history };
}
