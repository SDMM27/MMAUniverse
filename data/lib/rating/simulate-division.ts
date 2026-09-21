// data/lib/rating/simulate-division.ts
//
// Walks one division's finished fights in chronological order, applying
// computeDominanceScore + applyPointFlow to build up each fighter's points
// over their career -- the core simulation shared by the calibration script
// (data/scripts/calibrate-ratings.ts) and the real batch computation script
// (data/scripts/compute-fighter-ratings.ts, plan Task 7), so the "walk a
// division chronologically" logic exists in exactly one, unit-tested place.
// Pure function: the caller owns fetching/sorting the fight list and
// resolving fighter identities -- no DB access here.
import { computeDominanceScore, type FightStatsSide } from './dominance-score';
import { applyPointFlow, erodePoints, BASE_POINTS, DEFAULT_POINT_FLOW_PARAMS, type PointFlowParams } from './point-flow';

export type DivisionFightInput = {
  fightUrl: string; // for audit/dedup only, not used by the simulation itself
  eventDate: string; // ISO 'YYYY-MM-DD' -- inputs must already be sorted oldest-first by this
  isTitleFight: boolean;
  isFiveRounds: boolean;
  winnerId: number;
  loserId: number;
  winnerSide: FightStatsSide;
  loserSide: FightStatsSide;
};

/**
 * A fight with no winner (no contest or draw). No points change hands, but the
 * fighters did compete: inactivity erosion accrued so far is applied and the
 * inactivity clock restarts -- otherwise e.g. a champion whose last bout ended
 * in a no contest looks inactive since the fight before.
 */
export type DivisionNoResultInput = {
  eventDate: string; // ISO 'YYYY-MM-DD', sorted oldest-first like `fights`
  fighterIds: [number, number];
  isDraw: boolean; // a draw ends a win/loss streak, a no contest leaves it as is
};

export type SimulatedFighterState = {
  points: number;
  currentStreak: number; // positive = win streak, negative = loss streak
  isFormerChampion: boolean;
  lastFightDate: string | null;
  fightsSimulated: number;
};

export type DivisionHistoryEntry = {
  fightUrl: string;
  eventDate: string;
  winnerId: number;
  loserId: number;
  dominanceScore: number;
  dominanceEstimated: boolean;
  winnerPointsBefore: number;
  winnerPointsAfter: number;
  loserPointsBefore: number;
  loserPointsAfter: number;
  // Pre-fight points after inactivity erosion -- what the formula actually
  // compared at fight time, and what point-flow-tuning.ts predicts from.
  winnerPointsBeforeEroded: number;
  loserPointsBeforeEroded: number;
};

export type DivisionSimulationResult = {
  fighterStates: Map<number, SimulatedFighterState>;
  history: DivisionHistoryEntry[];
};

function newFighterState(): SimulatedFighterState {
  return { points: BASE_POINTS, currentStreak: 0, isFormerChampion: false, lastFightDate: null, fightsSimulated: 0 };
}

/** Approximate months between two ISO 'YYYY-MM-DD' dates (30.44-day months) -- good enough for the erosion curve, not meant to be calendar-exact. 0 for a fighter's first-ever fight (no prior date to measure from). */
export function monthsBetween(fromDateIso: string | null, toDateIso: string): number {
  if (!fromDateIso) return 0;
  const days = (new Date(toDateIso).getTime() - new Date(fromDateIso).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.44);
}

/**
 * A fighter's points as of `asOfDateIso`, inactivity erosion included.
 * The simulation only erodes a fighter when they fight again, so a retired
 * or long-inactive fighter's `state.points` stays frozen at their last fight
 * -- this is the value to rank/display "today", using the exact same erosion
 * curve the formula applies at fight time.
 */
export function pointsAsOf(
  state: SimulatedFighterState,
  asOfDateIso: string,
  params: PointFlowParams = DEFAULT_POINT_FLOW_PARAMS,
): number {
  return erodePoints(state.points, monthsBetween(state.lastFightDate, asOfDateIso), params);
}

/**
 * Simulates one division's full point-flow history. `fights` must already be
 * sorted chronologically (oldest first) by the caller -- this function
 * trusts that order rather than re-sorting, since the caller usually already
 * has the fights in a natural DB order it can sort once.
 *
 * The division-average-points term each fight's gain/loss depends on is
 * recomputed fresh before every fight from every fighter tracked so far in
 * this division (including the current fight's own winner/loser, whose
 * state is created at BASE_POINTS the moment they're first seen) -- not a
 * fixed constant. A fighter's `isFormerChampion` flag is read *before* this
 * fight's flow is applied and only set to true *after*, so winning a title
 * fight grants the bonus starting with the fighter's next fight, not the
 * title-winning one itself.
 *
 * `noResults` (no contests/draws, sorted oldest-first) are interleaved by
 * date: each one is applied before any fight strictly later than it.
 */
export function simulateDivisionRatings(
  fights: DivisionFightInput[],
  params: PointFlowParams = DEFAULT_POINT_FLOW_PARAMS,
  noResults: DivisionNoResultInput[] = [],
): DivisionSimulationResult {
  const states = new Map<number, SimulatedFighterState>();
  const history: DivisionHistoryEntry[] = [];
  let nextNoResult = 0;

  // Only fighters already rated are touched: a no contest can't create a
  // rating on its own (and before a first rated fight there's no clock to reset).
  const applyNoResultsBefore = (dateIso: string | null) => {
    while (nextNoResult < noResults.length && (dateIso === null || noResults[nextNoResult].eventDate < dateIso)) {
      const noResult = noResults[nextNoResult++];
      for (const fighterId of noResult.fighterIds) {
        const state = states.get(fighterId);
        if (!state) continue;
        state.points = pointsAsOf(state, noResult.eventDate, params);
        state.lastFightDate = noResult.eventDate;
        if (noResult.isDraw) state.currentStreak = 0;
      }
    }
  };

  const getState = (fighterId: number): SimulatedFighterState => {
    let state = states.get(fighterId);
    if (!state) {
      state = newFighterState();
      states.set(fighterId, state);
    }
    return state;
  };

  for (const fight of fights) {
    applyNoResultsBefore(fight.eventDate);
    const winnerState = getState(fight.winnerId);
    const loserState = getState(fight.loserId);

    let pointsSum = 0;
    Array.from(states.values()).forEach((s) => {
      pointsSum += s.points;
    });
    const divisionAveragePoints = pointsSum / states.size;

    const dominance = computeDominanceScore(fight.winnerSide, fight.loserSide);
    const winnerMonthsInactive = monthsBetween(winnerState.lastFightDate, fight.eventDate);
    const loserMonthsInactive = monthsBetween(loserState.lastFightDate, fight.eventDate);

    const flow = applyPointFlow(
      {
        points: winnerState.points,
        currentStreak: winnerState.currentStreak,
        isFormerChampion: winnerState.isFormerChampion,
        monthsSinceLastFight: winnerMonthsInactive,
      },
      {
        points: loserState.points,
        currentStreak: loserState.currentStreak,
        isFormerChampion: loserState.isFormerChampion,
        monthsSinceLastFight: loserMonthsInactive,
      },
      { dominanceScore: dominance.score, isTitleFight: fight.isTitleFight, isFiveRounds: fight.isFiveRounds, divisionAveragePoints },
      params,
    );

    history.push({
      fightUrl: fight.fightUrl,
      eventDate: fight.eventDate,
      winnerId: fight.winnerId,
      loserId: fight.loserId,
      dominanceScore: dominance.score,
      dominanceEstimated: dominance.estimated,
      winnerPointsBefore: winnerState.points,
      winnerPointsAfter: flow.winnerPoints,
      loserPointsBefore: loserState.points,
      loserPointsAfter: flow.loserPoints,
      winnerPointsBeforeEroded: erodePoints(winnerState.points, winnerMonthsInactive, params),
      loserPointsBeforeEroded: erodePoints(loserState.points, loserMonthsInactive, params),
    });

    winnerState.points = flow.winnerPoints;
    winnerState.currentStreak = winnerState.currentStreak >= 0 ? winnerState.currentStreak + 1 : 1;
    winnerState.isFormerChampion = winnerState.isFormerChampion || fight.isTitleFight;
    winnerState.lastFightDate = fight.eventDate;
    winnerState.fightsSimulated += 1;

    loserState.points = flow.loserPoints;
    loserState.currentStreak = loserState.currentStreak <= 0 ? loserState.currentStreak - 1 : -1;
    loserState.lastFightDate = fight.eventDate;
    loserState.fightsSimulated += 1;
  }

  applyNoResultsBefore(null);
  return { fighterStates: states, history };
}
