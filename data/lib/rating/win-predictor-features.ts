// data/lib/rating/win-predictor-features.ts
//
// Feature engineering for the FightScore win predictor -- see docs/superpowers/
// specs/2026-09-14-fighter-rating-algorithm-design.md, section 7, and the plan
// docs/superpowers/plans/2026-09-16-fightscore-win-predictor.md. Pure functions
// shared by the prototype, the training script and the batch computation, so
// the feature order/definition can never drift between training and inference.
// No DB access here.
import { BASE_POINTS } from './point-flow';
import { monthsBetween } from './simulate-division';

export const STYLE_WINDOW = 5;
export const PERFORMANCE_WINDOW = 3;

export type FightStyleSample = {
  minutes: number;
  head: number;
  body: number;
  leg: number;
  distance: number;
  clinch: number;
  ground: number;
  tdLanded: number;
  tdAttempted: number;
  control: number; // seconds
  subAttempts: number;
};

export type RunningFighterState = {
  points: number;
  currentStreak: number;
  isFormerChampion: boolean;
  lastFightDate: string | null;
  recentFights: FightStyleSample[]; // capped at STYLE_WINDOW, most recent last
  recentPerformance: number[]; // own-perspective dominance, capped at PERFORMANCE_WINDOW
};

/** Minimal shape of a fighter_fight_stats row this module needs -- lets scripts pass their own row type. */
export type FightStatsRowLike = {
  finish_round: number | null;
  finish_time: string | null;
  sig_strikes_head_attempted: number;
  sig_strikes_body_attempted: number;
  sig_strikes_leg_attempted: number;
  sig_strikes_distance_attempted: number;
  sig_strikes_clinch_attempted: number;
  sig_strikes_ground_attempted: number;
  takedowns_landed: number;
  takedowns_attempted: number;
  control_time_seconds: number | null;
  submission_attempts: number;
};

export function newRunningFighterState(): RunningFighterState {
  return { points: BASE_POINTS, currentStreak: 0, isFormerChampion: false, lastFightDate: null, recentFights: [], recentPerformance: [] };
}

/** Minutes actually fought: full rounds at 5 min each, plus the partial finishing round. 0 if round/time didn't parse. */
export function minutesFought(round: number | null, time: string | null): number {
  if (!round || !time) return 0;
  const match = time.match(/^(\d+):(\d{2})$/);
  if (!match) return 0;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return Math.max(0, (round - 1) * 5 + seconds / 60);
}

export function styleSampleFromRow(row: FightStatsRowLike): FightStyleSample {
  return {
    minutes: minutesFought(row.finish_round, row.finish_time),
    head: row.sig_strikes_head_attempted,
    body: row.sig_strikes_body_attempted,
    leg: row.sig_strikes_leg_attempted,
    distance: row.sig_strikes_distance_attempted,
    clinch: row.sig_strikes_clinch_attempted,
    ground: row.sig_strikes_ground_attempted,
    tdLanded: row.takedowns_landed,
    tdAttempted: row.takedowns_attempted,
    control: row.control_time_seconds ?? 0,
    subAttempts: row.submission_attempts,
  };
}

/** The 10 style rates over the fighter's last STYLE_WINDOW fights: per-15-minute strike/takedown/control/submission rates, takedown accuracy. All zeros with no fights. */
export function styleRates(state: RunningFighterState): number[] {
  const totalMinutes = state.recentFights.reduce((sum, f) => sum + f.minutes, 0);
  const sum = (key: keyof Omit<FightStyleSample, 'minutes'>) => state.recentFights.reduce((s, f) => s + f[key], 0);
  const per15 = (n: number) => (totalMinutes > 0 ? (n / totalMinutes) * 15 : 0);
  const tdAttempted = sum('tdAttempted');
  return [
    per15(sum('head')), per15(sum('body')), per15(sum('leg')), per15(sum('distance')), per15(sum('clinch')), per15(sum('ground')),
    per15(tdAttempted),
    tdAttempted > 0 ? sum('tdLanded') / tdAttempted : 0,
    per15(sum('control') / 60),
    per15(sum('subAttempts')),
  ];
}

export function averageRecentPerformance(state: RunningFighterState): number {
  if (state.recentPerformance.length === 0) return 0.5; // neutral prior for a fighter with no tracked fights yet
  return state.recentPerformance.reduce((s, v) => s + v, 0) / state.recentPerformance.length;
}

/** Months since the fighter's last fight as of `eventDate`; 0 for a first-ever fight. */
export function monthsSinceLastFight(lastFightDate: string | null, eventDate: string): number {
  return monthsBetween(lastFightDate, eventDate);
}

export const WIN_PREDICTOR_FEATURE_NAMES = [
  'pointsDiff',
  'streakDiff',
  'formerChampionDiff',
  'monthsSinceLastFightDiff',
  'recentPerformanceDiff',
  'sigStrikesHeadRateDiff',
  'sigStrikesBodyRateDiff',
  'sigStrikesLegRateDiff',
  'sigStrikesDistanceRateDiff',
  'sigStrikesClinchRateDiff',
  'sigStrikesGroundRateDiff',
  'takedownRateDiff',
  'takedownAccuracyDiff',
  'controlTimeRateDiff',
  'submissionAttemptRateDiff',
];

/**
 * A fighter's raw per-fighter feature values at one instant (before diffing).
 * Unlike RunningFighterState it can be averaged across fighters -- used to
 * build a division-average "opponent" for the batch computation. `formerChampion`
 * is 0/1 for one fighter, and a fractional share once averaged.
 */
export type MatchupProfile = {
  points: number;
  streak: number;
  formerChampion: number;
  monthsOff: number;
  recentPerformance: number;
  styleRates: number[]; // 10 values, styleRates() order
};

export function toMatchupProfile(state: RunningFighterState, eventDate: string): MatchupProfile {
  return {
    points: state.points,
    streak: state.currentStreak,
    formerChampion: state.isFormerChampion ? 1 : 0,
    monthsOff: monthsSinceLastFight(state.lastFightDate, eventDate),
    recentPerformance: averageRecentPerformance(state),
    styleRates: styleRates(state),
  };
}

/** Field-by-field mean of raw profiles (mean of raw values, not of diffs, so the diffs compose). Throws on an empty list. */
export function averageMatchupProfiles(profiles: MatchupProfile[]): MatchupProfile {
  if (profiles.length === 0) throw new Error('averageMatchupProfiles requires at least one profile');
  const n = profiles.length;
  const mean = (pick: (p: MatchupProfile) => number) => profiles.reduce((s, p) => s + pick(p), 0) / n;
  return {
    points: mean((p) => p.points),
    streak: mean((p) => p.streak),
    formerChampion: mean((p) => p.formerChampion),
    monthsOff: mean((p) => p.monthsOff),
    recentPerformance: mean((p) => p.recentPerformance),
    styleRates: profiles[0].styleRates.map((_, d) => mean((p) => p.styleRates[d])),
  };
}

/** The 15-length diff vector (A - B) fed to the model, in WIN_PREDICTOR_FEATURE_NAMES order. */
export function buildMatchupFeaturesFromProfiles(a: MatchupProfile, b: MatchupProfile): number[] {
  return [
    a.points - b.points,
    a.streak - b.streak,
    a.formerChampion - b.formerChampion,
    a.monthsOff - b.monthsOff,
    a.recentPerformance - b.recentPerformance,
    ...a.styleRates.map((v, d) => v - b.styleRates[d]),
  ];
}

export function buildMatchupFeatures(a: RunningFighterState, b: RunningFighterState, eventDate: string): number[] {
  return buildMatchupFeaturesFromProfiles(toMatchupProfile(a, eventDate), toMatchupProfile(b, eventDate));
}

/**
 * Applies one fight's result to a fighter's state (mutates). Does NOT touch
 * `points` -- the caller owns that (it comes from the point-flow simulation).
 * Streak flips on a result change, a title-fight win latches isFormerChampion,
 * and the performance push is own-perspective: dominanceScore for the winner,
 * 1 - dominanceScore for the loser.
 */
export function recordFightResult(
  state: RunningFighterState,
  sample: FightStyleSample,
  won: boolean,
  dominanceScore: number,
  isTitleFight: boolean,
  eventDate: string,
): void {
  if (won) {
    state.currentStreak = state.currentStreak >= 0 ? state.currentStreak + 1 : 1;
    state.isFormerChampion = state.isFormerChampion || isTitleFight;
  } else {
    state.currentStreak = state.currentStreak <= 0 ? state.currentStreak - 1 : -1;
  }
  state.recentPerformance.push(won ? dominanceScore : 1 - dominanceScore);
  if (state.recentPerformance.length > PERFORMANCE_WINDOW) state.recentPerformance.shift();
  state.recentFights.push(sample);
  if (state.recentFights.length > STYLE_WINDOW) state.recentFights.shift();
  state.lastFightDate = eventDate;
}

/** One already-simulated fight, ready to replay into running fighter states. */
export type ReplayFight = {
  eventDate: string;
  isTitleFight: boolean;
  winnerId: number;
  loserId: number;
  winnerSample: FightStyleSample;
  loserSample: FightStyleSample;
  dominanceScore: number;
  winnerPointsAfter: number;
  loserPointsAfter: number;
};

/**
 * Replays a division's fights (oldest first) into per-fighter running states.
 * `onBeforeFight` fires with each fighter's state strictly BEFORE the fight is
 * applied (points are the point-flow points going into it), which is where
 * training examples are built. Returns the final states.
 */
export function replayDivision(
  fights: ReplayFight[],
  onBeforeFight?: (fight: ReplayFight, index: number, winnerState: RunningFighterState, loserState: RunningFighterState) => void,
): Map<number, RunningFighterState> {
  const states = new Map<number, RunningFighterState>();
  const getState = (id: number) => {
    let s = states.get(id);
    if (!s) {
      s = newRunningFighterState();
      states.set(id, s);
    }
    return s;
  };

  fights.forEach((fight, i) => {
    const winnerState = getState(fight.winnerId);
    const loserState = getState(fight.loserId);
    onBeforeFight?.(fight, i, winnerState, loserState);
    recordFightResult(winnerState, fight.winnerSample, true, fight.dominanceScore, fight.isTitleFight, fight.eventDate);
    recordFightResult(loserState, fight.loserSample, false, fight.dominanceScore, fight.isTitleFight, fight.eventDate);
    winnerState.points = fight.winnerPointsAfter;
    loserState.points = fight.loserPointsAfter;
  });
  return states;
}
