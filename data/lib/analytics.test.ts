import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResultCube,
  buildTrendCube,
  computeReachFactor,
  computeWinFactors,
  finishesByRound,
  groupFightRows,
  normalizeSherdogDivision,
  orgFinishRates,
  parseResultRows,
  streakFrom,
  sumCells,
  trendMetricValue,
  ufcStatsMethod,
  type FightStatsRow,
  type ResultFightRow,
} from './analytics';

// --- UFCStats (detailed stats, UFC only) -------------------------------------

function statRow(overrides: Partial<FightStatsRow>): FightStatsRow {
  return {
    fighter_id: 1,
    ufcstats_fight_url: 'f1',
    event_date: '2024-01-01',
    result: 'win',
    weight_class: 'Lightweight',
    method: 'KO/TKO',
    finish_round: 1,
    finish_time: '2:30',
    scheduled_rounds: 3,
    sig_strikes_landed: 10,
    sig_strikes_attempted: 20,
    takedowns_landed: 1,
    takedowns_attempted: 2,
    control_time_seconds: 30,
    knockdowns: 1,
    reach_cm: null,
    height_cm: null,
    age_years: null,
    ...overrides,
  };
}

/** Two rows (winner fighter `w`, loser `l`) for one UFCStats fight. */
function statFight(url: string, date: string, w: number, l: number, extra: Partial<FightStatsRow> = {}, wExtra: Partial<FightStatsRow> = {}, lExtra: Partial<FightStatsRow> = {}) {
  return [
    statRow({ ufcstats_fight_url: url, event_date: date, fighter_id: w, result: 'win', ...extra, ...wExtra }),
    statRow({ ufcstats_fight_url: url, event_date: date, fighter_id: l, result: 'loss', ...extra, ...lExtra }),
  ];
}

test('ufcStatsMethod maps UFCStats labels', () => {
  assert.equal(ufcStatsMethod('KO/TKO'), 'ko');
  assert.equal(ufcStatsMethod("TKO - Doctor's Stoppage"), 'ko');
  assert.equal(ufcStatsMethod('Submission'), 'sub');
  assert.equal(ufcStatsMethod('Decision - Split'), 'dec');
  assert.equal(ufcStatsMethod('Overturned'), 'other');
  assert.equal(ufcStatsMethod(null), 'other');
});

test('groupFightRows folds both corners, sums stats and drops undated rows', () => {
  const fights = groupFightRows([
    ...statFight('a', '2024-03-02', 1, 2, { weight_class: 'Interim Lightweight' }),
    statRow({ ufcstats_fight_url: 'b', event_date: null }),
    statRow({ ufcstats_fight_url: 'c', event_date: '2023-05-05', weight_class: 'Catch Weight' }),
  ]);
  assert.equal(fights.length, 2);
  assert.equal(fights[0].url, 'c');
  assert.equal(fights[0].division, null);
  assert.equal(fights[0].complete, false);
  assert.equal(fights[1].division, 'Lightweight');
  assert.equal(fights[1].sigLanded, 20);
  assert.equal(fights[1].minutes, 2.5);
  assert.equal(fights[1].complete, true);
});

test('stat metrics: per-fighter rates halve the corner sums', () => {
  const fights = groupFightRows([
    ...statFight('a', '2024-01-01', 1, 2, { method: 'KO/TKO', finish_round: 1, finish_time: '5:00' }),
    ...statFight('b', '2024-02-01', 3, 4, { method: 'Decision - Unanimous', finish_round: 3, finish_time: '5:00' }),
  ]);
  const totals = sumCells(buildTrendCube(fights, '06-15'));
  assert.equal(trendMetricValue(totals, 'sigPer15'), (40 * 15) / (20 * 2));
  assert.equal(trendMetricValue(totals, 'sigAccuracy'), 0.5);
  assert.equal(trendMetricValue(totals, 'controlShare'), 120 / (20 * 60));
});

test('trendMetricValue returns null on an empty slice', () => {
  assert.equal(trendMetricValue(sumCells([]), 'finishRate'), null);
});

test('computeReachFactor buckets the reach gap of decided fights', () => {
  const fights = groupFightRows([
    ...statFight('a', '2024-01-01', 1, 2, {}, { reach_cm: 190 }, { reach_cm: 180 }),
    ...statFight('b', '2024-01-02', 3, 4, {}, { reach_cm: 180 }, { reach_cm: 182 }),
    ...statFight('c', '2024-01-03', 5, 6, {}, { reach_cm: 180 }, { reach_cm: 180 }),
  ]);
  const buckets = computeReachFactor(fights).buckets;
  assert.deepEqual(buckets[1], { label: '6 à 10 cm', short: '6-10 cm', wins: 1, total: 1 });
  assert.deepEqual(buckets[0], { label: '1 à 5 cm', short: '1-5 cm', wins: 0, total: 1 });
});

// --- Results (Sherdog, every organization) -------------------------------------

function resultRow(overrides: Partial<ResultFightRow>): ResultFightRow {
  return {
    organization: 'UFC',
    date: '2024-01-01',
    weight_class: 'Lightweight',
    method: 'KO (Punch)',
    round: 1,
    time: '2:30',
    winner_id: 1,
    fighter1_id: 1,
    fighter2_id: 2,
    height1: null,
    height2: null,
    age1: null,
    age2: null,
    history1: 0,
    history2: 0,
    prior_fights1: 0,
    prior_fights2: 0,
    last_date1: null,
    last_date2: null,
    recent1: null,
    recent2: null,
    ...overrides,
  };
}

test('normalizeSherdogDivision keeps plain weight classes, drops catchweights and blanks', () => {
  assert.equal(normalizeSherdogDivision(' Light Heavyweight '), 'Light Heavyweight');
  assert.equal(normalizeSherdogDivision('Strawweight'), 'Strawweight');
  assert.equal(normalizeSherdogDivision('150lb Catchweight'), null);
  assert.equal(normalizeSherdogDivision(''), null);
  assert.equal(normalizeSherdogDivision(null), null);
});

test('streakFrom: newest first, no contests skipped, draws end the streak', () => {
  assert.equal(streakFrom(['win', 'win', 'loss']), 2);
  assert.equal(streakFrom(['loss', 'nc', 'loss', 'win']), -2);
  assert.equal(streakFrom(['draw', 'win']), 0);
  assert.equal(streakFrom(['win', 'draw', 'win']), 1);
  assert.equal(streakFrom([]), 0);
});

test('parseResultRows maps methods, winner side and the prior record', () => {
  const [fight] = parseResultRows([
    resultRow({
      date: '2024-06-01',
      method: 'Submission (Armbar)',
      winner_id: 2,
      age1: '31.50',
      history1: '10',
      prior_fights1: '9',
      last_date1: '2024-03-03',
      recent1: ['loss', 'loss', 'win'],
      history2: 0,
    }),
  ]);
  assert.equal(fight.method, 'sub');
  assert.equal(fight.minutes, 2.5);
  assert.equal(fight.sides[0].won, false);
  assert.equal(fight.sides[1].won, true);
  assert.equal(fight.sides[0].ageYears, 31.5);
  assert.deepEqual(fight.sides[0].prior, { priorFights: 9, streak: -2, daysSinceLast: 90 });
  // No scraped history means "unknown", not "debut".
  assert.equal(fight.sides[1].prior, null);
});

test('result cube and finish metrics ignore "other" methods', () => {
  const fights = parseResultRows([
    resultRow({ method: 'TKO (Punches)', round: 1, time: '5:00' }),
    resultRow({ method: 'Decision (Unanimous)', round: 3, time: '5:00' }),
    resultRow({ method: 'DQ (Illegal Knee)', round: 2, time: '1:00' }),
    resultRow({ weight_class: '150lb Catchweight', method: 'Submission (Kimura)' }),
  ]);
  const cube = buildResultCube(fights, '06-15');
  assert.deepEqual(cube.map((cell) => cell.division).sort(), ['Autres', 'Lightweight']);
  const totals = sumCells(cube);
  assert.equal(totals.fights, 4);
  assert.equal(trendMetricValue(totals, 'finishRate'), 2 / 3);
  assert.equal(trendMetricValue(totals, 'avgMinutes'), (5 + 15 + 6 + 2.5) / 4);
});

test('finishesByRound spreads finishes over rounds 1-5', () => {
  const fights = parseResultRows([
    resultRow({ round: 1 }),
    resultRow({ round: 1 }),
    resultRow({ round: 4, method: 'Submission (Rear-Naked Choke)' }),
    resultRow({ round: 3, method: 'Decision (Split)' }),
  ]);
  const rounds = finishesByRound(fights);
  assert.deepEqual(rounds.map((r) => r.finishes), [2, 0, 0, 1, 0]);
  assert.equal(rounds[0].share, 2 / 3);
});

test('computeWinFactors: age gap, experience gap, streak and layoff buckets', () => {
  const fights = parseResultRows([
    // Younger fighter 1 (25 vs 35.5) wins; also has 2 more pro fights.
    resultRow({ winner_id: 1, age1: 25, age2: '35.5', history1: 5, history2: 3, prior_fights1: 5, prior_fights2: 3, recent1: ['win', 'win', 'win', 'win', 'win'], recent2: ['loss'], last_date1: '2023-12-01', last_date2: '2021-06-01' }),
    // Older fighter 2 (30 vs 28) wins; same age otherwise unknown history.
    resultRow({ winner_id: 2, age1: 28, age2: 30 }),
  ]);
  const factors = Object.fromEntries(computeWinFactors(fights).map((f) => [f.id, f.buckets]));
  assert.deepEqual(factors.age[3], { label: '9 ans et plus', short: '9 ans +', wins: 1, total: 1 });
  assert.deepEqual(factors.age[0], { label: 'Moins de 3 ans', short: '< 3 ans', wins: 0, total: 1 });
  assert.deepEqual([factors.experience[0].wins, factors.experience[0].total], [1, 1]);
  const fiveWins = factors.streak.find((b) => b.label === '5 victoires ou plus')!;
  const oneLoss = factors.streak.find((b) => b.label === '1 défaite')!;
  assert.deepEqual([fiveWins.wins, fiveWins.total, oneLoss.wins, oneLoss.total], [1, 1, 0, 1]);
  const shortLayoff = factors.layoff.find((b) => b.label === 'Moins de 4 mois')!;
  const longLayoff = factors.layoff.find((b) => b.label === 'Plus de 2 ans')!;
  assert.deepEqual([shortLayoff.wins, shortLayoff.total, longLayoff.wins, longLayoff.total], [1, 1, 0, 1]);
});

test('orgFinishRates keeps the recent window, drops small samples and sorts by finish rate', () => {
  const fights = parseResultRows([
    ...Array.from({ length: 3 }, () => resultRow({ organization: 'PFL', date: '2020-01-01', method: 'Submission (Armbar)' })),
    resultRow({ organization: 'PFL', date: '2020-01-01', method: 'Decision (Split)' }),
    resultRow({ organization: 'UFC', date: '2020-01-01', method: 'KO (Punch)' }),
    ...Array.from({ length: 3 }, () => resultRow({ organization: 'UFC', date: '2021-01-01', method: 'Decision (Unanimous)' })),
    resultRow({ organization: 'UFC', date: '2010-01-01', method: 'KO (Punch)' }),
    resultRow({ organization: 'LFA', date: '2024-01-01' }),
  ]);
  const rates = orgFinishRates(fights, 2016, 2);
  assert.deepEqual(rates.map((r) => r.organization), ['PFL', 'UFC']);
  assert.deepEqual(rates[1], { organization: 'UFC', fights: 4, ko: 1, sub: 0, dec: 3 });
});

test('cubes split each year at the cutoff day, so a window counted back from today is exact', () => {
  const fights = parseResultRows([
    resultRow({ date: '2021-03-01' }),
    resultRow({ date: '2021-10-05' }),
    resultRow({ date: '2021-12-31', method: 'Decision (Unanimous)' }),
    resultRow({ date: '2026-02-01' }),
  ]);
  const cube = buildResultCube(fights, '10-05');
  assert.deepEqual(
    cube.map((c) => [c.year, c.afterCutoff, c.fights]),
    [
      [2021, false, 1],
      [2021, true, 2],
      [2026, false, 1],
    ],
  );
  // "5 ans" on 2026-10-05: from 2021-10-05 (inclusive) onward.
  const window = sumCells(cube, (c) => c.year > 2021 || (c.year === 2021 && c.afterCutoff));
  assert.equal(window.fights, 3);
});
