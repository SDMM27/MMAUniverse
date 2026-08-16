import fs from 'node:fs';
import path from 'node:path';
import type { ScrapedOrgData } from './types';

export interface ScrapeProgress {
  processedEventUrls: string[];
  /** Every fighter URL discovered so far, mapped to the name seen on the event page. */
  fighterUrlToName: Record<string, string>;
  processedFighterUrls: string[];
  data: ScrapedOrgData;
}

function emptyProgress(organizationId: number): ScrapeProgress {
  return {
    processedEventUrls: [],
    fighterUrlToName: {},
    processedFighterUrls: [],
    data: { organization_id: organizationId, events: [], fighters: [], fights: [] },
  };
}

function progressPath(orgKey: string, cacheDir: string): string {
  return path.join(cacheDir, `${orgKey}-progress.json`);
}

export function loadProgress(orgKey: string, organizationId: number, cacheDir: string): ScrapeProgress {
  const file = progressPath(orgKey, cacheDir);
  if (!fs.existsSync(file)) {
    return emptyProgress(organizationId);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveProgress(orgKey: string, progress: ScrapeProgress, cacheDir: string): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(progressPath(orgKey, cacheDir), JSON.stringify(progress, null, 2));
}

export function clearProgress(orgKey: string, cacheDir: string): void {
  const file = progressPath(orgKey, cacheDir);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}
