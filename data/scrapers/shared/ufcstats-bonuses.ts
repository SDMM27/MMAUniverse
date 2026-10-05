// data/scrapers/shared/ufcstats-bonuses.ts
//
// The file scrape-ufcstats-bonuses.ts writes and sync-fighter-stats.ts reads.
import fs from 'node:fs';
import path from 'node:path';
import type { UfcStatsFightBonuses } from '../parse-ufcstats';

export const UFCSTATS_BONUSES_FILE = path.resolve('data/scraped/ufcstats-bonuses.json');

export type UfcStatsBonusFile = {
  events: Record<string, string>; // event URL -> event date ('' if unparsed) of every event walked
  fights: Record<string, UfcStatsFightBonuses>; // fight-details URL -> bonuses (only fights that earned one)
};

export function loadUfcStatsBonuses(file = UFCSTATS_BONUSES_FILE): UfcStatsBonusFile {
  if (!fs.existsSync(file)) return { events: {}, fights: {} };
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
