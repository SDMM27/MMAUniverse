// data/scrapers/parse-ufcstats.ts
//
// Pure cheerio-in/plain-object-out parsers for UFCStats.com — the per-fight
// granular stats (significant strikes, takedowns, control time, strike
// placement) that Sherdog's own "Fight History" table (see parse.ts /
// fighter_fight_history) never carries. UFC-only: UFCStats doesn't cover any
// other organization. Fetching these pages requires a real (headless)
// browser — see shared/fetch-playwright.ts's doc comment for why.
import type { CheerioAPI } from 'cheerio';

export interface UfcStatsEventMeta {
  name: string;
  date: string; // ISO 'YYYY-MM-DD', or '' if UFCStats' date text didn't parse
  location: string;
}

export interface UfcStatsLandedAttempted {
  landed: number;
  attempted: number;
}

export interface UfcStatsFightTotals {
  knockdowns: number;
  sigStrikes: UfcStatsLandedAttempted;
  totalStrikes: UfcStatsLandedAttempted;
  takedowns: UfcStatsLandedAttempted;
  submissionAttempts: number;
  reversals: number;
  /** null when UFCStats prints '--' (no control time recorded for this fighter). */
  controlTimeSeconds: number | null;
}

// UFCStats' own "Significant Strikes" location breakdown — landed-of-attempted
// by target (head/body/leg) and by position (distance/clinch/ground). Overlaps
// with totals.sigStrikes (same landed/attempted, just not broken down), which
// is why sig-strike % isn't re-parsed here.
export interface UfcStatsStrikeBreakdown {
  head: UfcStatsLandedAttempted;
  body: UfcStatsLandedAttempted;
  leg: UfcStatsLandedAttempted;
  distance: UfcStatsLandedAttempted;
  clinch: UfcStatsLandedAttempted;
  ground: UfcStatsLandedAttempted;
}

export interface UfcStatsFighterSide {
  name: string;
  ufcstatsUrl: string;
  result: 'win' | 'loss' | 'draw' | 'nc' | null;
  totals: UfcStatsFightTotals;
  strikes: UfcStatsStrikeBreakdown;
}

export interface UfcStatsFight {
  fighters: [UfcStatsFighterSide, UfcStatsFighterSide];
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// Parsed by hand (not `new Date(text).toISOString()`) because that route reads
// the "August 15, 2026" text as local midnight and then converts to UTC —
// an off-by-one day in any timezone ahead of UTC. Date.UTC sidesteps local
// time entirely.
/** Parses the month-name date UFCStats prints (e.g. "August 15, 2026") into ISO 'YYYY-MM-DD'; '' if unparseable. */
function parseUfcStatsDate(text: string): string {
  const match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return '';
  const monthIndex = MONTHS.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return '';
  const date = new Date(Date.UTC(Number(match[3]), monthIndex, Number(match[2])));
  return date.toISOString().slice(0, 10);
}

export function parseEventMeta($: CheerioAPI): UfcStatsEventMeta {
  const name = $('.b-content__title').first().text().trim();
  const infoText = $('.b-list__box-list').first().text().replace(/\s+/g, ' ').trim();
  const dateMatch = infoText.match(/Date:\s*(.+?)\s*(?:Location:|$)/);
  const locationMatch = infoText.match(/Location:\s*(.+?)\s*$/);
  return {
    name,
    date: dateMatch ? parseUfcStatsDate(dateMatch[1]) : '',
    location: locationMatch ? locationMatch[1] : '',
  };
}

/** Every completed-event URL on a `statistics/events/completed?page=all` listing page. */
export function parseCompletedEventUrls($: CheerioAPI): string[] {
  const urls: string[] = [];
  $('table.b-statistics__table-events tbody tr.b-statistics__table-row').each((_, row) => {
    const href = $(row).find('a').first().attr('href');
    if (href) urls.push(href);
  });
  return urls;
}

/** Every fight-details URL on an event-details page. */
export function parseEventFightUrls($: CheerioAPI): string[] {
  const urls = new Set<string>();
  $('tr.b-fight-details__table-row[data-link]').each((_, row) => {
    const link = $(row).attr('data-link');
    if (link) urls.add(link);
  });
  return Array.from(urls);
}

function parseLandedAttempted(text: string): UfcStatsLandedAttempted {
  const match = text.match(/(\d+)\s+of\s+(\d+)/);
  return match ? { landed: Number(match[1]), attempted: Number(match[2]) } : { landed: 0, attempted: 0 };
}

function parseIntOr0(text: string): number {
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseControlTime(text: string): number | null {
  const match = text.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const RESULT_BY_STATUS: Record<string, UfcStatsFighterSide['result']> = {
  W: 'win',
  L: 'loss',
  D: 'draw',
  NC: 'nc',
};

/**
 * Parses a fight-details page's two always-visible "Totals" tables (overall
 * fight totals + sig-strike location breakdown) into one record per fighter,
 * in page order. Deliberately skips the per-round tables UFCStats hides
 * behind its "Round-by-round" toggle (same columns, plus a `js-fight-table`
 * class marker) — fight-level totals are enough for a rating model; per-round
 * detail can be added later without touching this shape.
 */
export function parseFightDetails($: CheerioAPI): UfcStatsFight {
  const persons = $('.b-fight-details__person');
  const nameFor = (i: number) => persons.eq(i).find('.b-fight-details__person-name a').text().trim();
  const urlFor = (i: number) => persons.eq(i).find('.b-fight-details__person-name a').attr('href') || '';
  const statusFor = (i: number) => persons.eq(i).find('.b-fight-details__person-status').text().trim();

  // The two stat tables that carry fight-level (not per-round) totals are the
  // ones without UFCStats' `js-fight-table` class, in document order: totals
  // first, then the sig-strike location breakdown.
  const tables = $('table').filter((_, el) => !$(el).hasClass('js-fight-table'));
  const totalsCells = tables.eq(0).find('tbody tr').first().find('td');
  const strikesCells = tables.eq(1).find('tbody tr').first().find('td');

  const totalsCell = (col: number, side: number) => totalsCells.eq(col).find('p').eq(side).text().trim();
  const strikesCell = (col: number, side: number) => strikesCells.eq(col).find('p').eq(side).text().trim();

  const sideFor = (i: 0 | 1): UfcStatsFighterSide => ({
    name: nameFor(i),
    ufcstatsUrl: urlFor(i),
    result: RESULT_BY_STATUS[statusFor(i)] ?? null,
    totals: {
      knockdowns: parseIntOr0(totalsCell(1, i)),
      sigStrikes: parseLandedAttempted(totalsCell(2, i)),
      totalStrikes: parseLandedAttempted(totalsCell(4, i)),
      takedowns: parseLandedAttempted(totalsCell(5, i)),
      submissionAttempts: parseIntOr0(totalsCell(7, i)),
      reversals: parseIntOr0(totalsCell(8, i)),
      controlTimeSeconds: parseControlTime(totalsCell(9, i)),
    },
    strikes: {
      head: parseLandedAttempted(strikesCell(3, i)),
      body: parseLandedAttempted(strikesCell(4, i)),
      leg: parseLandedAttempted(strikesCell(5, i)),
      distance: parseLandedAttempted(strikesCell(6, i)),
      clinch: parseLandedAttempted(strikesCell(7, i)),
      ground: parseLandedAttempted(strikesCell(8, i)),
    },
  });

  return { fighters: [sideFor(0), sideFor(1)] };
}
