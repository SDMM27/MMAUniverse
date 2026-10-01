// data/lib/rating/style-archetype.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStyles, decayedTotals, STYLE_LABELS, type StyleCandidate, type StyleSample } from './style-archetype';

// A 15-minute fight of an "average" fighter: mostly distance striking, a bit of everything.
function fight(overrides: Partial<StyleSample> = {}): StyleSample {
  return {
    seconds: 900, takedownsLanded: 1, controlSeconds: 120, groundLanded: 4, submissionAttempts: 0.2,
    distanceLanded: 30, headLanded: 25, clinchLanded: 5, knockdowns: 0.2, sigLanded: 40,
    ...overrides,
  };
}

// Deterministic jitter so the reference pool has some spread on every stat.
function jittered(i: number): StyleSample {
  const j = (k: number) => 1 + 0.25 * Math.sin(i * 1.7 + k);
  const f = fight();
  return {
    ...f,
    takedownsLanded: f.takedownsLanded * j(1), controlSeconds: f.controlSeconds * j(2), groundLanded: f.groundLanded * j(3),
    submissionAttempts: f.submissionAttempts * j(4), distanceLanded: f.distanceLanded * j(5), headLanded: f.headLanded * j(6),
    clinchLanded: f.clinchLanded * j(7), knockdowns: f.knockdowns * j(8),
  };
}

function candidate(fighterId: number, fights: StyleSample[], isReference = true): StyleCandidate {
  return { fighterId, totals: decayedTotals(fights), fights: fights.length, isReference };
}

function pool(): StyleCandidate[] {
  return Array.from({ length: 40 }, (_, i) => candidate(i + 1, [jittered(i), jittered(i + 40), jittered(i + 80), jittered(i + 120)]));
}

test('decayedTotals weighs recent fights more than old ones', () => {
  const totals = decayedTotals([fight({ submissionAttempts: 10 }), fight({ submissionAttempts: 0 })], 0.5);
  assert.equal(totals.submissionAttempts, 5);
  assert.equal(totals.seconds, 900 * 0.5 + 900);
});

test('a dominant wrestler is labelled Lutteur / contrôleur', () => {
  const wrestler = candidate(100, Array.from({ length: 6 }, () => fight({ takedownsLanded: 5, controlSeconds: 500, groundLanded: 25 })));
  assert.equal(classifyStyles([...pool(), wrestler]).get(100), STYLE_LABELS.grappling);
});

test('a high-volume distance striker is labelled Frappeur de distance', () => {
  const striker = candidate(100, Array.from({ length: 6 }, () => fight({ takedownsLanded: 0, controlSeconds: 10, groundLanded: 0, distanceLanded: 70, headLanded: 55, sigLanded: 80 })));
  assert.equal(classifyStyles([...pool(), striker]).get(100), STYLE_LABELS.distance);
});

test('a few submission attempts in a division where nobody attempts any do not make a submission specialist', () => {
  // ~0.6 attempts per 15 min: far above this pool's average, but under the absolute floor.
  const striker = candidate(100, Array.from({ length: 12 }, (_, i) => fight({ submissionAttempts: i % 3 === 0 ? 1.8 : 0, distanceLanded: 45, headLanded: 35, sigLanded: 55 })));
  assert.notEqual(classifyStyles([...pool(), striker]).get(100), STYLE_LABELS.submission);
});

test('a real submission hunter is labelled Spécialiste soumission', () => {
  const hunter = candidate(100, Array.from({ length: 6 }, () => fight({ submissionAttempts: 2.5 })));
  assert.equal(classifyStyles([...pool(), hunter]).get(100), STYLE_LABELS.submission);
});

test('one quick knockout in a short career is shrunk toward the average', () => {
  // 3 fights, one ended by a single knockdown after 2 minutes: a huge raw rate, not a puncher yet.
  const short = candidate(100, [fight(), fight(), fight({ knockdowns: 1, seconds: 120 })]);
  assert.notEqual(classifyStyles([...pool(), short]).get(100), STYLE_LABELS.power);
});

test('an average fighter is Polyvalent', () => {
  assert.equal(classifyStyles([...pool(), candidate(100, [fight(), fight(), fight(), fight()])]).get(100), STYLE_LABELS.balanced);
});

test('fighters with fewer than 3 UFC fights get no style', () => {
  assert.equal(classifyStyles([...pool(), candidate(100, [fight(), fight()])]).get(100), null);
});

test('a division too small to compare against labels nobody', () => {
  const labels = classifyStyles(pool().slice(0, 5));
  assert.ok(Array.from(labels.values()).every((label) => label === null));
});
