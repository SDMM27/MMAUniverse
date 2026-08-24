// data/lib/scoring.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePick } from './scoring';

test('scorePick awards 20 points for a fully correct pick (winner + method + round)', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'submission', predicted_round: 2 },
    { winner_id: 1, method: 'Submission (Rear-Naked Choke)', round: 2 },
  );
  assert.equal(points, 20);
});

test('scorePick awards 15 points for winner + method correct, round wrong', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: 1, method: 'TKO (Punches)', round: 3 },
  );
  assert.equal(points, 15);
});

test('scorePick awards 10 points for winner correct, method wrong', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'decision', predicted_round: null },
    { winner_id: 1, method: 'TKO (Punches)', round: 2 },
  );
  assert.equal(points, 10);
});

test('scorePick awards 0 points when the predicted winner is wrong, even if method matches', () => {
  const points = scorePick(
    { predicted_winner_id: 2, predicted_method_category: 'decision', predicted_round: null },
    { winner_id: 1, method: 'Decision (Unanimous)', round: 3 },
  );
  assert.equal(points, 0);
});

test('scorePick never awards a round bonus for a decision, even if predicted_round happens to equal the actual round', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'decision', predicted_round: 3 },
    { winner_id: 1, method: 'Decision (Unanimous)', round: 3 },
  );
  assert.equal(points, 15); // winner + method, no round bonus for decisions
});

test('scorePick awards 0 points for a draw/no-contest, regardless of pick', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: null, method: 'No Contest', round: 0 },
  );
  assert.equal(points, 0);
});

test('scorePick awards only the winner bonus when the real method is unpredictable (e.g. disqualification)', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: 1, method: 'Disqualification (Illegal Elbow)', round: 2 },
  );
  assert.equal(points, 10);
});
