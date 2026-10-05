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

// One row per round actually fought (row order in the page = round order;
// UFCStats doesn't print a separate round-number column on this table, see
// parseFightDetails). Same shape as UfcStatsFightTotals -- the round-by-round
// "Totals" table UFCStats renders behind its "Per round" toggle has the exact
// same column layout as the fight-level totals table, just one row per round
// instead of one row for the whole fight.
export interface UfcStatsRoundStats extends UfcStatsFightTotals {
  round: number;
}

export interface UfcStatsFighterSide {
  name: string;
  ufcstatsUrl: string;
  result: 'win' | 'loss' | 'draw' | 'nc' | null;
  totals: UfcStatsFightTotals;
  strikes: UfcStatsStrikeBreakdown;
  rounds: UfcStatsRoundStats[];
}

// Fight-level facts that apply to both corners, not a specific fighter --
// weight class, how/when it ended, and the scheduled format. All read off
// the same `.b-fight-details__text` block UFCStats renders once per fight.
export interface UfcStatsFightMeta {
  weightClass: string;
  isTitleFight: boolean; // from the same fight-title text as weightClass -- see stripWeightClassSuffix
  method: string;
  round: number; // the round the fight ended in (decisions: the last round)
  time: string;
  scheduledRounds: number; // 3 or 5, from "Time format: N Rnd (...)"
}

export interface UfcStatsFight {
  fighters: [UfcStatsFighterSide, UfcStatsFighterSide];
  meta: UfcStatsFightMeta;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// Parsed by hand (not `new Date(text).toISOString()`) because that route reads
// the "August 15, 2026" text as local midnight and then converts to UTC —
// an off-by-one day in any timezone ahead of UTC. Date.UTC sidesteps local
// time entirely.
/**
 * Parses the month-name date UFCStats prints (e.g. "August 15, 2026", or
 * "Dec 13, 1996" for a fighter's DOB) into ISO 'YYYY-MM-DD'; '' if unparseable.
 */
function parseUfcStatsDate(text: string): string {
  const match = text.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return '';
  const monthIndex = MONTHS.findIndex((month) => month.startsWith(match[1].toLowerCase()));
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
/** Every completed event on the listing page, with the name its row links under. */
export function parseCompletedEvents($: CheerioAPI): { url: string; name: string }[] {
  const events: { url: string; name: string }[] = [];
  $('table.b-statistics__table-events tbody tr.b-statistics__table-row').each((_, row) => {
    const $link = $(row).find('a').first();
    const href = $link.attr('href');
    if (href) events.push({ url: href, name: $link.text().trim() });
  });
  return events;
}

export function parseCompletedEventUrls($: CheerioAPI): string[] {
  return parseCompletedEvents($).map((e) => e.url);
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

export interface UfcStatsFightBonuses {
  fightOfTheNight: boolean;
  performanceOfTheNight: boolean; // Performance, and the legacy KO / Submission of the Night
}

/**
 * The UFC bonuses each fight of an event page earned, keyed by fight-details
 * URL. UFCStats marks them with an icon in the fight's row (fight.png = Fight
 * of the Night, perf.png = Performance, and sub.png / ko.png = the old
 * Submission / KO of the Night); belt.png (title fight) is not a bonus. Only
 * fights that earned one are in the map.
 */
export function parseEventBonuses($: CheerioAPI): Map<string, UfcStatsFightBonuses> {
  const bonuses = new Map<string, UfcStatsFightBonuses>();
  $('tr.b-fight-details__table-row[data-link]').each((_, row) => {
    const url = $(row).attr('data-link');
    if (!url) return;
    const icons = $(row)
      .find('img')
      .map((__, img) => ($(img).attr('src') ?? '').split('/').pop())
      .get();
    const fightOfTheNight = icons.includes('fight.png');
    const performanceOfTheNight = icons.some((icon) => icon === 'perf.png' || icon === 'sub.png' || icon === 'ko.png');
    if (fightOfTheNight || performanceOfTheNight) bonuses.set(url, { fightOfTheNight, performanceOfTheNight });
  });
  return bonuses;
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
 * "Lightweight Bout" -> "Lightweight"; "UFC Welterweight Title Bout" ->
 * "Welterweight" (both real strings seen on live UFCStats pages -- the "UFC "
 * prefix and "Title" appear to correlate with championship bouts, ordinary
 * bouts have neither).
 */
function stripWeightClassSuffix(titleText: string): string {
  return titleText
    .replace(/^UFC\s+/i, '')
    .replace(/\s+(?:Title\s+)?Bout$/i, '')
    .trim();
}

/** True when the fight-title text contains "Title" (case-insensitive) -- e.g. "UFC Welterweight Title Bout". */
function parseIsTitleFight(titleText: string): boolean {
  return /\btitle\b/i.test(titleText);
}

/**
 * Parses the fight-level facts UFCStats renders once per fight (not
 * per-corner): weight class, method/round/time the fight ended, and the
 * scheduled round format -- all read off the same
 * `.b-fight-details__fight-title` / `.b-fight-details__text` blocks, e.g.
 * "Method: KO/TKO Round: 1 Time: 0:39 Time format: 3 Rnd (5-5-5) Referee: ...".
 */
export function parseFightMeta($: CheerioAPI): UfcStatsFightMeta {
  const titleText = $('.b-fight-details__fight-title').first().text().replace(/\s+/g, ' ').trim();
  const weightClass = stripWeightClassSuffix(titleText);
  const isTitleFight = parseIsTitleFight(titleText);

  // The Method/Round/Time/Time-format/Referee line is the first of two
  // `.b-fight-details__text` blocks (the second carries judge scorecards /
  // finish details) -- `.first()` picks it regardless of that second block's
  // presence.
  const detailsText = $('.b-fight-details__content .b-fight-details__text').first().text().replace(/\s+/g, ' ').trim();
  const methodMatch = detailsText.match(/Method:\s*(.+?)\s*Round:/i);
  const roundMatch = detailsText.match(/Round:\s*(\d+)\s*Time:/i);
  const timeMatch = detailsText.match(/Time:\s*([\d:]+)\s*Time format:/i);
  const scheduledMatch = detailsText.match(/Time format:\s*(\d+)\s*Rnd/i);

  return {
    weightClass,
    isTitleFight,
    method: methodMatch ? methodMatch[1].trim() : '',
    round: roundMatch ? parseInt(roundMatch[1], 10) : 0,
    time: timeMatch ? timeMatch[1].trim() : '',
    scheduledRounds: scheduledMatch ? parseInt(scheduledMatch[1], 10) : 0,
  };
}

/**
 * Parses a fight-details page's two always-visible "Totals" tables (overall
 * fight totals + sig-strike location breakdown), the fight-level meta
 * (weight class/method/round/time/scheduled rounds), and the round-by-round
 * "Totals" table UFCStats hides behind its "Per round" toggle -- same column
 * layout as the fight-level totals table, one row per round actually fought,
 * marked with a `js-fight-table` class. Deliberately does NOT parse the
 * round-by-round *strike-location* breakdown (head/body/leg/distance/
 * clinch/ground per round, the second `js-fight-table`) -- nothing in the
 * rating engine needs per-round location detail, only per-round totals.
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

  // First `js-fight-table` = round-by-round "Totals" (same 10-column layout
  // as `tables.eq(0)` above); rows span multiple sibling <tbody> elements (one
  // per round, each preceded by its own "Round N" <thead>) but `.find()`
  // collects them across all of them in document order regardless.
  const roundRows = $('table.js-fight-table').eq(0).find('tbody tr.b-fight-details__table-row');
  const roundsFor = (side: number): UfcStatsRoundStats[] => {
    const rounds: UfcStatsRoundStats[] = [];
    roundRows.each((i, row) => {
      const $row = $(row);
      const cell = (col: number) => $row.find('td').eq(col).find('p').eq(side).text().trim();
      rounds.push({
        round: i + 1,
        knockdowns: parseIntOr0(cell(1)),
        sigStrikes: parseLandedAttempted(cell(2)),
        totalStrikes: parseLandedAttempted(cell(4)),
        takedowns: parseLandedAttempted(cell(5)),
        submissionAttempts: parseIntOr0(cell(7)),
        reversals: parseIntOr0(cell(8)),
        controlTimeSeconds: parseControlTime(cell(9)),
      });
    });
    return rounds;
  };

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
    rounds: roundsFor(i),
  });

  return { fighters: [sideFor(0), sideFor(1)], meta: parseFightMeta($) };
}

export interface UfcStatsFighterPhysique {
  heightCm: number | null;
  reachCm: number | null;
}

/** `5' 7"` -> 170, `69"` -> 175 (inches only, as UFCStats prints reach); null for '--' or anything else. */
export function imperialToCm(text: string): number | null {
  const match = text.trim().match(/^(?:(\d+)'\s*)?(\d+(?:\.\d+)?)"$/);
  if (!match) return null;
  const inches = Number(match[1] ?? 0) * 12 + Number(match[2]);
  return inches > 0 ? Math.round(inches * 2.54) : null;
}

/**
 * Height and reach off a UFCStats fighter-details page's bio box
 * ("Height: 5' 7"", "Reach: 69""), converted to centimeters. UFCStats prints
 * '--' for a fighter it has no measurement for -- common for reach on
 * fighters from the early UFC era.
 */
export function parseFighterPhysique($: CheerioAPI): UfcStatsFighterPhysique {
  return { heightCm: imperialToCm(bioValue($, 'height')), reachCm: imperialToCm(bioValue($, 'reach')) };
}

/** DOB off the same bio box ("DOB: Dec 13, 1996"), as ISO 'YYYY-MM-DD'; null for '--'. */
export function parseFighterBirthDate($: CheerioAPI): string | null {
  return parseUfcStatsDate(bioValue($, 'dob').replace(/\s+/g, ' ')) || null;
}

// Text of one "Label: value" row of a fighter-details bio box, label stripped.
function bioValue($: CheerioAPI, label: string): string {
  const item = $('.b-list__info-box_style_small-width li')
    .filter((_, li) => $(li).find('i').text().trim().toLowerCase() === `${label}:`)
    .first();
  return item.clone().children('i').remove().end().text().trim();
}
