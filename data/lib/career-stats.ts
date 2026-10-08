// data/lib/career-stats.ts
//
// Career statistics from UFCStats per-fight rows, computed the way UFCStats
// does on a fighter page: per-minute / per-15-minutes rates over total fight
// time, accuracies as landed / attempted. Pure -- the DB read is
// fetchFighterUfcFightStats (./fighter-profile-data.ts). UFC-only data.

export type OpponentFightTotals = {
  sigStrikesLanded: number;
  takedownsLanded: number;
  takedownsAttempted: number;
};

export type UfcFightStatsRow = {
  finishRound: number | null;
  finishTime: string | null;
  knockdowns: number;
  sigStrikesLanded: number;
  sigStrikesAttempted: number;
  takedownsLanded: number;
  takedownsAttempted: number;
  submissionAttempts: number;
  controlTimeSeconds: number | null;
  headLanded: number;
  bodyLanded: number;
  legLanded: number;
  // The opponent's side of the same fight, when we have it (null otherwise).
  opponent: OpponentFightTotals | null;
};

export type CareerStats = {
  fights: number;
  totalMinutes: number;
  knockdowns: number;
  sigStrikesLandedPerMinute: number;
  sigStrikeAccuracy: number | null;
  sigStrikesAbsorbedPerMinute: number | null;
  takedownsPer15: number;
  takedownAccuracy: number | null;
  takedownDefense: number | null;
  submissionAttemptsPer15: number;
  averageControlSeconds: number | null;
  controlShare: number | null;
  strikeDistribution: { head: number; body: number; leg: number } | null;
};

/**
 * Fight length in seconds from UFCStats' final round + clock ("m:ss" in that
 * round). Rounds before the last are counted as 5 minutes, which also holds
 * for decisions (UFCStats records the last round and its 5:00 clock). Null
 * when the data is missing or malformed.
 */
export function fightDurationSeconds(finishRound: number | null, finishTime: string | null): number | null {
  if (!finishRound || finishRound < 1 || !finishTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(finishTime.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  const total = (finishRound - 1) * 300 + seconds;
  return total > 0 ? total : null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Null when no row has a usable duration (nothing to compute rates over). */
export function computeCareerStats(rows: UfcFightStatsRow[]): CareerStats | null {
  const timed = rows
    .map((row) => ({ row, seconds: fightDurationSeconds(row.finishRound, row.finishTime) }))
    .filter((entry): entry is { row: UfcFightStatsRow; seconds: number } => entry.seconds !== null);
  if (timed.length === 0) return null;

  let seconds = 0;
  let knockdowns = 0;
  let sigLanded = 0;
  let sigAttempted = 0;
  let tdLanded = 0;
  let tdAttempted = 0;
  let subAttempts = 0;
  let head = 0;
  let body = 0;
  let leg = 0;
  let controlSeconds = 0;
  let controlFightSeconds = 0;
  let controlFights = 0;
  let oppSeconds = 0;
  let oppSigLanded = 0;
  let oppTdLanded = 0;
  let oppTdAttempted = 0;

  for (const { row, seconds: duration } of timed) {
    seconds += duration;
    knockdowns += row.knockdowns;
    sigLanded += row.sigStrikesLanded;
    sigAttempted += row.sigStrikesAttempted;
    tdLanded += row.takedownsLanded;
    tdAttempted += row.takedownsAttempted;
    subAttempts += row.submissionAttempts;
    head += row.headLanded;
    body += row.bodyLanded;
    leg += row.legLanded;
    if (row.controlTimeSeconds !== null) {
      controlSeconds += row.controlTimeSeconds;
      controlFightSeconds += duration;
      controlFights += 1;
    }
    if (row.opponent) {
      oppSeconds += duration;
      oppSigLanded += row.opponent.sigStrikesLanded;
      oppTdLanded += row.opponent.takedownsLanded;
      oppTdAttempted += row.opponent.takedownsAttempted;
    }
  }

  const minutes = seconds / 60;
  const targetStrikes = head + body + leg;
  return {
    fights: timed.length,
    totalMinutes: minutes,
    knockdowns,
    sigStrikesLandedPerMinute: sigLanded / minutes,
    sigStrikeAccuracy: ratio(sigLanded, sigAttempted),
    sigStrikesAbsorbedPerMinute: oppSeconds > 0 ? oppSigLanded / (oppSeconds / 60) : null,
    takedownsPer15: (tdLanded * 15) / minutes,
    takedownAccuracy: ratio(tdLanded, tdAttempted),
    takedownDefense: oppTdAttempted > 0 ? 1 - oppTdLanded / oppTdAttempted : null,
    submissionAttemptsPer15: (subAttempts * 15) / minutes,
    averageControlSeconds: controlFights > 0 ? controlSeconds / controlFights : null,
    controlShare: ratio(controlSeconds, controlFightSeconds),
    strikeDistribution:
      targetStrikes > 0 ? { head: head / targetStrikes, body: body / targetStrikes, leg: leg / targetStrikes } : null,
  };
}
