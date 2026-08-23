import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProgress, saveProgress, clearProgress } from './checkpoint';

function tempCacheDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mma-scraper-checkpoint-test-'));
}

test('loadProgress returns an empty progress object when no file exists', () => {
  const cacheDir = tempCacheDir();
  const progress = loadProgress('ufc', 1, cacheDir);

  assert.deepEqual(progress, {
    processedEventUrls: [],
    fighterUrlToName: {},
    processedFighterUrls: [],
    data: { organization_id: 1, events: [], fighters: [], fights: [] },
  });
});

test('saveProgress then loadProgress round-trips the data', () => {
  const cacheDir = tempCacheDir();
  const progress = loadProgress('pfl', 2, cacheDir);
  progress.processedEventUrls.push('https://www.sherdog.com/events/example-1');
  progress.data.events.push({ name: 'Example Event', date: '2024-01-01', start_time: '2024-01-01T00:00:00Z', event_location: 'Somewhere', event_poster: '' });

  saveProgress('pfl', progress, cacheDir);

  const reloaded = loadProgress('pfl', 2, cacheDir);
  assert.deepEqual(reloaded, progress);
});

test('clearProgress removes the checkpoint file', () => {
  const cacheDir = tempCacheDir();
  const progress = loadProgress('bellator', 3, cacheDir);
  saveProgress('bellator', progress, cacheDir);

  clearProgress('bellator', cacheDir);

  const reloaded = loadProgress('bellator', 3, cacheDir);
  assert.deepEqual(reloaded.processedEventUrls, []);
});
