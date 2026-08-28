// data/lib/fighter-stats.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFighterStats } from './fighter-stats';

test('computeFighterStats tallies win methods by category', () => {
  const stats = computeFighterStats([
    { method: 'TKO (Punches)', result: 'win' },
    { method: 'Submission (Rear-Naked Choke)', result: 'win' },
    { method: 'Decision (Unanimous)', result: 'win' },
  ]);

  assert.equal(stats.wins, 3);
  assert.deepEqual(stats.winMethods, { koTko: 1, submission: 1, decision: 1 });
});

test('computeFighterStats tallies loss methods by category', () => {
  const stats = computeFighterStats([
    { method: 'KO (Head Kick)', result: 'loss' },
    { method: 'Technical Submission (Kimura)', result: 'loss' },
    { method: 'Technical Decision (Majority)', result: 'loss' },
  ]);

  assert.equal(stats.losses, 3);
  assert.deepEqual(stats.lossMethods, { koTko: 1, submission: 1, decision: 1 });
});

test('computeFighterStats counts a win or loss with an unclassifiable method toward the total but not any method bucket', () => {
  const stats = computeFighterStats([
    { method: 'Disqualification (Biting)', result: 'win' },
    { method: 'No Contest', result: 'loss' },
  ]);

  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.deepEqual(stats.winMethods, { koTko: 0, submission: 0, decision: 0 });
  assert.deepEqual(stats.lossMethods, { koTko: 0, submission: 0, decision: 0 });
});

test('computeFighterStats counts draws independent of method', () => {
  const stats = computeFighterStats([{ method: 'Draw (Majority)', result: 'draw' }]);

  assert.equal(stats.draws, 1);
  assert.deepEqual(stats.winMethods, { koTko: 0, submission: 0, decision: 0 });
  assert.deepEqual(stats.lossMethods, { koTko: 0, submission: 0, decision: 0 });
});

test('computeFighterStats ignores upcoming and no-contest results', () => {
  const stats = computeFighterStats([
    { method: null, result: 'upcoming' },
    { method: 'No Contest (Accidental Clash of Heads)', result: 'nc' },
  ]);

  assert.deepEqual(stats, {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: { koTko: 0, submission: 0, decision: 0 },
    lossMethods: { koTko: 0, submission: 0, decision: 0 },
  });
});

test('computeFighterStats returns all-zero stats for an empty fight list', () => {
  const stats = computeFighterStats([]);

  assert.deepEqual(stats, {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: { koTko: 0, submission: 0, decision: 0 },
    lossMethods: { koTko: 0, submission: 0, decision: 0 },
  });
});
