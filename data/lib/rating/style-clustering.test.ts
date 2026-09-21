// data/lib/rating/style-clustering.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFeatures, kMeans, labelCluster, type StyleFeatures } from './style-clustering';

function features(overrides: Partial<StyleFeatures>): StyleFeatures {
  return {
    sigStrikesHeadRate: 5,
    sigStrikesBodyRate: 2,
    sigStrikesLegRate: 1,
    sigStrikesDistanceRate: 6,
    sigStrikesClinchRate: 1,
    sigStrikesGroundRate: 1,
    takedownRate: 0.5,
    takedownAccuracy: 0.4,
    controlTimeRate: 60,
    submissionAttemptRate: 0.2,
    ...overrides,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

test('normalizeFeatures produces mean-0, unit-variance columns for a feature that actually varies', () => {
  const set = [
    features({ sigStrikesHeadRate: 2 }),
    features({ sigStrikesHeadRate: 4 }),
    features({ sigStrikesHeadRate: 6 }),
    features({ sigStrikesHeadRate: 8 }),
    features({ sigStrikesHeadRate: 10 }),
  ];

  const normalized = normalizeFeatures(set);
  const headColumn = normalized.map((row) => row[0]); // sigStrikesHeadRate is FEATURE_KEYS[0]

  assert.ok(Math.abs(mean(headColumn)) < 1e-9, `expected mean ~0, got ${mean(headColumn)}`);
  assert.ok(Math.abs(stddev(headColumn) - 1) < 1e-9, `expected stddev ~1, got ${stddev(headColumn)}`);
});

test('normalizeFeatures normalizes a constant (zero-variance) column to flat 0 instead of dividing by zero', () => {
  const set = [features({}), features({}), features({})]; // every fighter identical
  const normalized = normalizeFeatures(set);

  for (const row of normalized) {
    for (const value of row) {
      assert.equal(value, 0);
    }
  }
});

test('normalizeFeatures returns an empty array for an empty input', () => {
  assert.deepEqual(normalizeFeatures([]), []);
});

test('kMeans separates two well-separated synthetic blobs into two distinct clusters', () => {
  const blobA = [
    [0, 0],
    [0.1, -0.1],
    [-0.1, 0.1],
    [0.2, 0],
  ];
  const blobB = [
    [10, 10],
    [10.1, 9.9],
    [9.9, 10.1],
    [10, 10.2],
  ];
  const points = [...blobA, ...blobB];

  const { assignments } = kMeans(points, 2, 7);

  const blobAAssignments = assignments.slice(0, blobA.length);
  const blobBAssignments = assignments.slice(blobA.length);
  assert.ok(blobAAssignments.every((a) => a === blobAAssignments[0]), `expected blob A all in one cluster, got ${blobAAssignments}`);
  assert.ok(blobBAssignments.every((a) => a === blobBAssignments[0]), `expected blob B all in one cluster, got ${blobBAssignments}`);
  assert.notEqual(blobAAssignments[0], blobBAssignments[0], 'expected the two blobs in different clusters');
});

test('kMeans is deterministic for a given seed', () => {
  const points = [
    [0, 0],
    [1, 1],
    [10, 10],
    [11, 11],
    [5, 0],
    [6, 1],
  ];
  const run1 = kMeans(points, 3, 99);
  const run2 = kMeans(points, 3, 99);
  assert.deepEqual(run1.assignments, run2.assignments);
  assert.deepEqual(run1.centroids, run2.centroids);
});

test('kMeans returns empty results for an empty point set', () => {
  assert.deepEqual(kMeans([], 3), { assignments: [], centroids: [] });
});

test('labelCluster labels a centroid dominated by ground strikes, control time and takedowns as a grappler', () => {
  // FEATURE_KEYS order: head, body, leg, distance, clinch, ground, takedown, tdAcc, control, subAttempt
  const centroid = [-0.5, 0, 0, -0.8, 0, 1.5, 1.4, 0.5, 1.6, 0.3];
  assert.equal(labelCluster(centroid), 'Wrestler / Contrôleur');
});

test('labelCluster labels a centroid dominated by distance and head strikes as a distance striker', () => {
  const centroid = [1.6, 0.2, 0.1, 1.7, -0.3, -0.8, -0.6, 0, -0.7, -0.2];
  assert.equal(labelCluster(centroid), 'Frappeur de distance');
});
