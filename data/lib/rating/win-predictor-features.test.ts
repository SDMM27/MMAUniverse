import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STYLE_WINDOW,
  PERFORMANCE_WINDOW,
  WIN_PREDICTOR_FEATURE_NAMES,
  newRunningFighterState,
  styleRates,
  averageRecentPerformance,
  monthsSinceLastFight,
  buildMatchupFeatures,
  buildMatchupFeaturesFromProfiles,
  toMatchupProfile,
  averageMatchupProfiles,
  recordFightResult,
  replayDivision,
  minutesFought,
  type FightStyleSample,
  type ReplayFight,
} from './win-predictor-features';

const sample = (over: Partial<FightStyleSample> = {}): FightStyleSample => ({
  minutes: 15, head: 0, body: 0, leg: 0, distance: 0, clinch: 0, ground: 0, tdLanded: 0, tdAttempted: 0, control: 0, subAttempts: 0, ...over,
});

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('styleRates matches hand-computed per-15-minute rates over two fights', () => {
  const s = newRunningFighterState();
  s.recentFights.push(sample({ minutes: 10, head: 50, tdLanded: 1, tdAttempted: 2, control: 120, subAttempts: 1 }));
  s.recentFights.push(sample({ minutes: 5, head: 25, tdLanded: 1, tdAttempted: 2, control: 60, subAttempts: 2 }));
  // 15 minutes total: 75 head strikes, 4 td attempts (2 landed), 180s control (3 min), 3 sub attempts.
  const r = styleRates(s);
  close(r[0], 75); // head per 15
  close(r[6], 4); // td attempted per 15
  close(r[7], 0.5); // td accuracy
  close(r[8], 3); // control minutes per 15
  close(r[9], 3); // sub attempts per 15
  assert.equal(r.length, 10);
});

test('styleRates with no fights is all zeros, not NaN', () => {
  assert.deepEqual(styleRates(newRunningFighterState()), new Array(10).fill(0));
});

test('styleRates only reflects the last STYLE_WINDOW fights', () => {
  const s = newRunningFighterState();
  for (let i = 0; i < STYLE_WINDOW + 1; i++) {
    recordFightResult(s, sample({ head: i === 0 ? 1000 : 10 }), true, 0.5, false, '2024-01-01');
  }
  assert.equal(s.recentFights.length, STYLE_WINDOW);
  close(styleRates(s)[0], 10); // the 1000-strike first fight fell out of the window
});

test('averageRecentPerformance: 0.5 neutral prior when empty, mean of the last PERFORMANCE_WINDOW otherwise', () => {
  const s = newRunningFighterState();
  assert.equal(averageRecentPerformance(s), 0.5);
  s.recentPerformance = [0.2];
  close(averageRecentPerformance(s), 0.2);
  for (const v of [0.4, 0.6, 0.8]) recordFightResult(s, sample(), true, v, false, '2024-01-01');
  assert.equal(s.recentPerformance.length, PERFORMANCE_WINDOW);
  close(averageRecentPerformance(s), 0.6); // (0.4 + 0.6 + 0.8) / 3
});

test('monthsSinceLastFight: 0 for null, ~12 for one year', () => {
  assert.equal(monthsSinceLastFight(null, '2024-01-01'), 0);
  const m = monthsSinceLastFight('2023-01-01', '2024-01-01'); // 365 / 30.44
  assert.ok(Math.abs(m - 11.99) < 0.05, `got ${m}`);
  assert.equal(monthsSinceLastFight('2024-06-01', '2024-01-01'), 0); // never negative
});

test('minutesFought parses round + time, 0 on garbage', () => {
  close(minutesFought(3, '2:30'), 12.5);
  assert.equal(minutesFought(null, '2:30'), 0);
  assert.equal(minutesFought(2, 'bad'), 0);
});

test('buildMatchupFeatures produces the exact expected 15 values in feature-name order', () => {
  const a = newRunningFighterState();
  a.points = 10;
  a.currentStreak = 3;
  a.isFormerChampion = true;
  a.lastFightDate = '2023-07-01';
  a.recentPerformance = [0.8, 0.6];
  a.recentFights = [sample({ minutes: 15, head: 30, body: 15, leg: 6, distance: 45, clinch: 3, ground: 3, tdLanded: 2, tdAttempted: 4, control: 180, subAttempts: 1 })];

  const b = newRunningFighterState();
  b.points = 4;
  b.currentStreak = -2;
  b.lastFightDate = '2023-12-01';
  b.recentPerformance = [0.3];
  b.recentFights = [sample({ minutes: 30, head: 30, body: 30, leg: 0, distance: 30, clinch: 30, ground: 0, tdLanded: 0, tdAttempted: 0, control: 0, subAttempts: 2 })];

  const f = buildMatchupFeatures(a, b, '2024-01-01');
  assert.equal(f.length, WIN_PREDICTOR_FEATURE_NAMES.length);
  assert.equal(f.length, 15);

  const monthsA = monthsSinceLastFight('2023-07-01', '2024-01-01');
  const monthsB = monthsSinceLastFight('2023-12-01', '2024-01-01');
  const expected = [
    6, // pointsDiff
    5, // streakDiff (3 - -2)
    1, // formerChampionDiff
    monthsA - monthsB,
    0.7 - 0.3, // recentPerformanceDiff
    30 - 15, // head: A 30/15min*15=30, B 30/30*15=15
    15 - 15, // body: A 15, B 30/30*15=15
    6 - 0, // leg
    45 - 15, // distance
    3 - 15, // clinch
    3 - 0, // ground
    4 - 0, // takedown attempts rate
    0.5 - 0, // takedown accuracy (2/4 vs 0)
    3 - 0, // control minutes per 15 (180s = 3min over 15min)
    1 - 1, // sub attempts: A 1, B 2/30*15=1
  ];
  expected.forEach((v, i) => close(f[i], v, 1e-9));
});

test('averageMatchupProfiles averages raw values; formerChampion becomes a fractional share', () => {
  const champ = newRunningFighterState();
  champ.isFormerChampion = true;
  champ.points = 10;
  champ.currentStreak = 4;
  const other = newRunningFighterState();
  other.points = 2;
  other.currentStreak = -2;
  const avg = averageMatchupProfiles([toMatchupProfile(champ, '2024-01-01'), toMatchupProfile(other, '2024-01-01')]);
  close(avg.points, 6);
  close(avg.streak, 1);
  close(avg.formerChampion, 0.5);
  close(avg.recentPerformance, 0.5);
  assert.equal(avg.styleRates.length, 10);
  assert.throws(() => averageMatchupProfiles([]));
});

test('a fighter compared against the average of a set containing only themselves has an all-zero feature vector', () => {
  const s = newRunningFighterState();
  s.points = 7;
  s.currentStreak = 2;
  recordFightResult(s, sample({ head: 20 }), true, 0.7, true, '2023-01-01');
  const p = toMatchupProfile(s, '2024-01-01');
  assert.deepEqual(buildMatchupFeaturesFromProfiles(p, averageMatchupProfiles([p])), new Array(15).fill(0));
});

test('recordFightResult: alternating results give +1, -1, +1 (no accumulating counter)', () => {
  const s = newRunningFighterState();
  recordFightResult(s, sample(), true, 0.5, false, '2024-01-01');
  assert.equal(s.currentStreak, 1);
  recordFightResult(s, sample(), false, 0.5, false, '2024-02-01');
  assert.equal(s.currentStreak, -1);
  recordFightResult(s, sample(), true, 0.5, false, '2024-03-01');
  assert.equal(s.currentStreak, 1);
  recordFightResult(s, sample(), true, 0.5, false, '2024-04-01');
  assert.equal(s.currentStreak, 2);
  recordFightResult(s, sample(), false, 0.5, false, '2024-05-01');
  recordFightResult(s, sample(), false, 0.5, false, '2024-06-01');
  assert.equal(s.currentStreak, -2);
});

test('recordFightResult: a title-fight win latches isFormerChampion, a title-fight loss does not, and it survives a later loss', () => {
  const loser = newRunningFighterState();
  recordFightResult(loser, sample(), false, 0.5, true, '2024-01-01');
  assert.equal(loser.isFormerChampion, false);

  const s = newRunningFighterState();
  recordFightResult(s, sample(), true, 0.5, true, '2024-01-01');
  assert.equal(s.isFormerChampion, true);
  recordFightResult(s, sample(), false, 0.5, false, '2024-02-01');
  assert.equal(s.isFormerChampion, true);
});

test('recordFightResult: winner pushes dominance verbatim, loser pushes 1 - dominance, date updates, windows capped', () => {
  const w = newRunningFighterState();
  const l = newRunningFighterState();
  recordFightResult(w, sample(), true, 0.9, false, '2024-01-01');
  recordFightResult(l, sample(), false, 0.9, false, '2024-01-01');
  close(w.recentPerformance[0], 0.9);
  close(l.recentPerformance[0], 0.1);
  assert.equal(w.lastFightDate, '2024-01-01');
  for (let i = 0; i < 10; i++) recordFightResult(w, sample(), true, 0.5, false, '2024-01-01');
  assert.equal(w.recentFights.length, STYLE_WINDOW);
  assert.equal(w.recentPerformance.length, PERFORMANCE_WINDOW);
});

test('replayDivision calls onBeforeFight with pre-fight state and returns final states with points from the simulation', () => {
  const fight = (over: Partial<ReplayFight>): ReplayFight => ({
    eventDate: '2024-01-01', isTitleFight: false, winnerId: 1, loserId: 2,
    winnerSample: sample({ head: 10 }), loserSample: sample({ head: 5 }),
    dominanceScore: 0.8, winnerPointsAfter: 5, loserPointsAfter: 1, ...over,
  });
  const seen: { streakW: number; pointsW: number; pointsL: number; perfW: number }[] = [];
  const states = replayDivision(
    [fight({}), fight({ eventDate: '2024-06-01', winnerId: 2, loserId: 1, winnerPointsAfter: 6, loserPointsAfter: 2, dominanceScore: 0.6 })],
    (_f, _i, w, l) => seen.push({ streakW: w.currentStreak, pointsW: w.points, pointsL: l.points, perfW: averageRecentPerformance(w) }),
  );
  assert.equal(seen[0].streakW, 0);
  assert.equal(seen[0].perfW, 0.5);
  assert.ok(seen[0].pointsW > 0); // BASE_POINTS, not 0/undefined
  assert.equal(seen[1].pointsW, 1); // fighter 2 going into fight 2 has fighter-2's points after fight 1 (loserPointsAfter)
  assert.equal(seen[1].pointsL, 5);
  assert.equal(seen[1].streakW, -1); // fighter 2 lost fight 1
  assert.equal(states.get(1)!.points, 2);
  assert.equal(states.get(2)!.points, 6);
  assert.equal(states.get(2)!.currentStreak, 1);
  assert.equal(states.get(1)!.currentStreak, -1);
});
