import type { MethodCategory } from './definitions';

/**
 * Maps free-text Sherdog method strings (e.g. "TKO (Doctor Stoppage)",
 * "Submission (Rear-Naked Choke)") onto the three categories the pick'em
 * lets a user predict. Methods no one can meaningfully predict (DQ, no
 * contest, draw) map to 'other' — scorePick (data/lib/scoring.ts, a later
 * task) never reaches the method comparison for those, since they have no
 * winner_id.
 */
export function normalizeMethodCategory(method: string): MethodCategory | 'other' {
  const normalized = method.trim().toLowerCase();
  if (normalized.startsWith('ko') || normalized.startsWith('tko')) return 'ko_tko';
  if (normalized.startsWith('submission') || normalized.startsWith('submision') || normalized.startsWith('technical submission')) {
    return 'submission';
  }
  if (normalized.startsWith('decision') || normalized.startsWith('technical decision')) return 'decision';
  return 'other';
}
