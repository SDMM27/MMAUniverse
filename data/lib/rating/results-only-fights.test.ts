// data/lib/rating/results-only-fights.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultOnlyDivision, resultsOnlyCareerInputs, type ResultOnlyFightRow } from './results-only-fights';
import { computeDominanceScore } from './dominance-score';

function row(overrides: Partial<ResultOnlyFightRow>): ResultOnlyFightRow {
  return {
    fight_id: 1,
    event_date: '2026-11-01',
    weight_class: 'Lightweight',
    method: 'Decision (Unanimous)',
    round: 3,
    winner_id: 10,
    fighter1_id: 10,
    fighter2_id: 20,
    is_title_fight: false,
    is_main_event: false,
    is_women: false,
    ...overrides,
  };
}

test("a women's bout labelled with the bare weight class lands in the women's division", () => {
  assert.equal(resultOnlyDivision({ weight_class: 'Bantamweight', is_women: true }), "Women's Bantamweight");
  assert.equal(resultOnlyDivision({ weight_class: 'Bantamweight', is_women: false }), 'Bantamweight');
  assert.equal(resultOnlyDivision({ weight_class: "Women's Flyweight", is_women: true }), "Women's Flyweight");
});

test('a catchweight goes to the division with the nearest limit', () => {
  assert.equal(resultOnlyDivision({ weight_class: '157lb Catchweight', is_women: false }), 'Lightweight');
  assert.equal(resultOnlyDivision({ weight_class: '158lbCatchweight', is_women: false }), 'Lightweight');
  assert.equal(resultOnlyDivision({ weight_class: '190lb Catchweight', is_women: false }), 'Middleweight');
  assert.equal(resultOnlyDivision({ weight_class: '119lb Catchweight', is_women: true }), "Women's Strawweight");
});

test('a weight class with nothing to go on is skipped and counted', () => {
  const { fights, skippedUnmatchedDivision } = resultsOnlyCareerInputs([row({ weight_class: 'Openweight' }), row({ weight_class: null })]);
  assert.equal(fights.length, 0);
  assert.equal(skippedUnmatchedDivision, 2);
});

test('no winner and no draw / no contest method: an incomplete row, skipped rather than guessed', () => {
  const { fights, noResults, skippedNoResult } = resultsOnlyCareerInputs([row({ winner_id: null, method: 'Submission (Rear-Naked Choke)' })]);
  assert.equal(fights.length + noResults.length, 0);
  assert.equal(skippedNoResult, 1);
});

test('the loser is whichever fighter is not the winner', () => {
  const { fights } = resultsOnlyCareerInputs([row({ winner_id: 20 })]);
  assert.equal(fights[0].winnerId, 20);
  assert.equal(fights[0].loserId, 10);
});

test('dominance comes from the method alone, flagged as estimated', () => {
  const [ko, split] = resultsOnlyCareerInputs([
    row({ fight_id: 1, method: 'TKO (Punches)', round: 2 }),
    row({ fight_id: 2, method: 'Decision (Split)' }),
  ]).fights;
  const koScore = computeDominanceScore(ko.winnerSide, ko.loserSide);
  const splitScore = computeDominanceScore(split.winnerSide, split.loserSide);
  assert.equal(koScore.estimated, true);
  assert.equal(koScore.score, 1);
  assert.ok(Math.abs(splitScore.score - 0.3) < 1e-9); // flat 0.4 for a decision, minus the split penalty
  assert.equal(ko.winnerSide.finishRound, 2);
  assert.equal(split.winnerSide.finishRound, null);
});

test('a fight with no winner becomes a no-result entry, a draw ending streaks', () => {
  const { fights, noResults } = resultsOnlyCareerInputs([
    row({ fight_id: 1, winner_id: null, method: 'Draw (Majority)' }),
    row({ fight_id: 2, winner_id: null, method: 'No Contest (Accidental Eye Poke)' }),
  ]);
  assert.equal(fights.length, 0);
  assert.deepEqual(
    noResults.map((n) => [n.isDraw, n.fighterIds, n.division]),
    [
      [true, [10, 20], 'Lightweight'],
      [false, [10, 20], 'Lightweight'],
    ],
  );
});

test('title fights and main events are five-rounders', () => {
  const [title, main, prelim] = resultsOnlyCareerInputs([
    row({ fight_id: 1, is_title_fight: true }),
    row({ fight_id: 2, is_main_event: true }),
    row({ fight_id: 3 }),
  ]).fights;
  assert.deepEqual([title.isFiveRounds, main.isFiveRounds, prelim.isFiveRounds], [true, true, false]);
  assert.deepEqual([title.isTitleFight, main.isTitleFight], [true, false]);
  assert.equal(title.fightUrl, 'fights:1');
});
