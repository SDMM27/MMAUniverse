// data/scrapers/shared/ufcstats-checkpoint.ts
//
// Same crash-resumable-JSON-file pattern as checkpoint.ts (used by the
// Sherdog scraper), kept separate rather than shared: that one's shape
// (ScrapeProgress) is tied to ScrapedOrgData's events/fighters/fights split,
// which doesn't fit UFCStats' single flat list of per-fighter fight-stat rows.
import fs from 'node:fs';
import path from 'node:path';
import type { UfcStatsFightRecord } from './ufcstats-types';

export interface UfcStatsProgress {
  processedEventUrls: string[];
  records: UfcStatsFightRecord[];
}

function progressPath(cacheDir: string): string {
  return path.join(cacheDir, 'ufcstats-progress.json');
}

export function loadUfcStatsProgress(cacheDir: string): UfcStatsProgress {
  const file = progressPath(cacheDir);
  if (!fs.existsSync(file)) {
    return { processedEventUrls: [], records: [] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveUfcStatsProgress(cacheDir: string, progress: UfcStatsProgress): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(progressPath(cacheDir), JSON.stringify(progress, null, 2));
}
