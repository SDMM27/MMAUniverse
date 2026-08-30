// data/scrapers/parse.ts
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { normalizeDate, normalizeStartTime } from './shared/normalize-date';
import type { ScrapedFightHistoryEntry } from './shared/types';

export type FinalResult = 'win' | 'loss' | 'draw' | 'nc' | 'not_finished';

export interface ParsedFighterSide {
  name: string;
  sherdogUrl: string;
  result: FinalResult;
}

export interface ParsedFight {
  weight_class: string;
  fighter1: ParsedFighterSide;
  fighter2: ParsedFighterSide;
  method: string;
  round: number;
  time: string;
  /** True for the single fight parsed from `.fight_card` — Sherdog's featured/main-event bout for the page. */
  is_main_event: boolean;
  /** True when Sherdog marks the bout with its `span.title_fight` "TITLE FIGHT" badge — independent of is_main_event, since a title bout can also sit as a co-main. */
  is_title_fight: boolean;
}

export interface ParsedEventDetails {
  name: string;
  date: string;
  start_time: string;
  location: string;
  poster: string;
  fights: ParsedFight[];
}

export interface ParsedFighterDetails {
  name: string;
  imageUrl: string;
  weightClass: string;
  wins: number;
  losses: number;
  draws: number;
  fightHistory: ParsedFighterHistoryEntry[];
}

export interface ParsedFighterHistoryEntry {
  opponentName: string;
  opponentSherdogUrl: string;
  eventName: string;
  eventSherdogUrl: string;
  date: string; // ISO 'YYYY-MM-DD' when parseable, else '' — Sherdog renders it as "May / 16 / 2026"
  /** Sherdog's own lowercase label for the row: 'win' | 'loss' | 'draw' | 'nc' (no contest) — kept as raw text rather than a fixed union since new labels shouldn't crash parsing. */
  result: string;
  method: string;
  referee: string;
  round: number;
  time: string;
}

// Sherdog sometimes renders a disabled/placeholder link as `href="javascript:void();"`
// (e.g. an inactive "Older Events" control, or a malformed row in an event
// table) instead of omitting the href. `new URL()` happily parses those as
// absolute URLs, so without filtering by protocol they'd get queued up and
// axios would blow up trying to fetch `javascript:void();` over HTTP.
function absoluteUrl(href: string | undefined, baseUrl: string): string {
  if (!href) return '';
  const url = new URL(href, baseUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  return url.toString();
}

/** Collapses `<br>`-separated text nodes (e.g. a two-line fighter name) into a single space-joined string. */
function textWithBreaksAsSpaces($: CheerioAPI, el: Cheerio<AnyNode>): string {
  const clone = el.clone();
  clone.find('br').replaceWith(' ');
  return clone.text().replace(/\s+/g, ' ').trim();
}

/** Sherdog labels a value with a leading `<em>Label</em>` inside the same cell — strip it and return the rest. */
function textAfterLabel($: CheerioAPI, cell: Cheerio<AnyNode>): string {
  const clone = cell.clone();
  clone.find('em').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

function parseFinalResult(el: Cheerio<AnyNode>): FinalResult {
  if (!el.length) return 'not_finished';
  const className = el.attr('class') ?? '';
  if (className.includes('win')) return 'win';
  if (className.includes('loss')) return 'loss';
  // A completed draw or overturned no-contest is still a *finished* fight — Sherdog
  // renders those with their own badge classes rather than win/loss. Without this,
  // finished draws/no-contests fall through to 'not_finished' below and sherdog.ts's
  // `fight_finished` derivation (fighter1.result !== 'not_finished' || fighter2...)
  // then treats an already-fought bout as permanently upcoming.
  if (className.includes('draw')) return 'draw';
  if (className.includes('no_contest')) return 'nc';
  return 'not_finished';
}

export function parseEventTableUrls($: CheerioAPI, tabId: 'upcoming_tab' | 'recent_tab', baseUrl: string): string[] {
  const urls: string[] = [];
  $(`#${tabId} table.new_table.event tr[itemscope]`).each((_, row) => {
    const href = $(row).find('a[itemprop="url"]').attr('href');
    const resolved = absoluteUrl(href, baseUrl);
    if (resolved) urls.push(resolved);
  });
  return urls;
}

export function parseOlderEventsUrl($: CheerioAPI, baseUrl: string): string | null {
  let href: string | undefined;
  $('.pagination a').each((_, a) => {
    if ($(a).text().includes('Older Events')) {
      href = $(a).attr('href');
    }
  });
  const resolved = absoluteUrl(href, baseUrl);
  return resolved || null;
}

export function parseEventDetails($: CheerioAPI, baseUrl: string): ParsedEventDetails {
  const name = $('h1 span[itemprop="name"]').first().text().trim();
  const dateContent = $('.info meta[itemprop="startDate"]').first().attr('content') ?? '';
  const date = normalizeDate(dateContent);
  const start_time = normalizeStartTime(dateContent);
  const location = $('.info span[itemprop="location"]').first().text().trim();
  const poster = $('meta[itemprop="image"]').first().attr('content') ?? '';

  const fights: ParsedFight[] = [];

  const mainCard = $('.fight_card').first();
  if (mainCard.length) {
    const left = mainCard.find('.fighter.left_side');
    const right = mainCard.find('.fighter.right_side');
    const weightClass = mainCard.find('.versus span.weight_class').first().text().trim();
    const isTitleFight = mainCard.find('.versus span.title_fight').length > 0;

    const fighter1: ParsedFighterSide = {
      name: left.find('h3 span[itemprop="name"]').first().text().trim(),
      sherdogUrl: absoluteUrl(left.find('a[href^="/fighter/"]').first().attr('href'), baseUrl),
      result: parseFinalResult(left.find('.final_result')),
    };
    const fighter2: ParsedFighterSide = {
      name: right.find('h3 span[itemprop="name"]').first().text().trim(),
      sherdogUrl: absoluteUrl(right.find('a[href^="/fighter/"]').first().attr('href'), baseUrl),
      result: parseFinalResult(right.find('.final_result')),
    };

    const resumeCells = $('table.fight_card_resume tr').first().find('td');
    const method = resumeCells.length > 1 ? textAfterLabel($, resumeCells.eq(1)) : '';
    const round = resumeCells.length > 3 ? parseInt(textAfterLabel($, resumeCells.eq(3)), 10) || 0 : 0;
    const time = resumeCells.length > 4 ? textAfterLabel($, resumeCells.eq(4)) : '';

    if (fighter1.name && fighter2.name) {
      fights.push({ weight_class: weightClass, fighter1, fighter2, method, round, time, is_main_event: true, is_title_fight: isTitleFight });
    }
  }

  $('table.new_table.result tr[itemprop="subEvent"], table.new_table.upcoming tr[itemprop="subEvent"]').each((_, row) => {
    const $row = $(row);
    const weightClass = $row.find('td.text_center span.weight_class').first().text().trim();
    const isTitleFight = $row.find('td.text_center span.title_fight').length > 0;
    const leftCell = $row.find('td.text_right').first();
    const rightCell = $row.find('td.text_left').first();

    const fighter1: ParsedFighterSide = {
      name: textWithBreaksAsSpaces($, leftCell.find('a[itemprop="url"] span[itemprop="name"]').first()),
      sherdogUrl: absoluteUrl(leftCell.find('a[itemprop="url"]').first().attr('href'), baseUrl),
      result: parseFinalResult(leftCell.find('.final_result')),
    };
    const fighter2: ParsedFighterSide = {
      name: textWithBreaksAsSpaces($, rightCell.find('a[itemprop="url"] span[itemprop="name"]').first()),
      sherdogUrl: absoluteUrl(rightCell.find('a[itemprop="url"]').first().attr('href'), baseUrl),
      result: parseFinalResult(rightCell.find('.final_result')),
    };

    const winbyCell = $row.find('td.winby');
    const method = winbyCell.find('b').first().text().trim();
    const trailingCells = $row.find('td').slice(-2);
    const round = parseInt(trailingCells.eq(0).text().trim(), 10) || 0;
    const time = trailingCells.eq(1).text().trim();

    if (fighter1.name && fighter2.name) {
      fights.push({ weight_class: weightClass, fighter1, fighter2, method, round, time, is_main_event: false, is_title_fight: isTitleFight });
    }
  });

  return { name, date, start_time, location, poster, fights };
}

const MONTH_ABBREVIATIONS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

// Sherdog renders a fight history date as "May / 16 / 2026" — reformat to ISO
// 'YYYY-MM-DD' so it sorts/compares like every other date in this codebase.
// Parsed as UTC calendar fields (not `new Date(string)`, which reads the
// pieces as local time and can shift the date by a day once converted back
// via toISOString depending on the host's timezone) — returns '' rather than
// throwing on anything that doesn't match the expected shape.
function normalizeHistoryDate(text: string): string {
  const match = text.match(/^([A-Za-z]{3})[A-Za-z]*\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return '';
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return '';
  const day = Number(match[2]);
  const year = Number(match[3]);
  const iso = new Date(Date.UTC(year, monthIndex, day));
  return iso.toISOString().slice(0, 10);
}

/**
 * Parses the "Fight History - Pro" table from a fighter's own Sherdog page —
 * the same page `parseFighterDetails` already loads, so this costs no extra
 * request. This is the fighter's complete career record across every
 * organization Sherdog knows about, independent of which orgs we scrape —
 * unlike `fights` rows (reconstructed from our own scraped events), it still
 * has a fighter's full history even when they just transferred into a
 * tracked org from one we've never scraped.
 * Only the first `.module.fight_history` is used: Sherdog repeats the same
 * table markup elsewhere on the page in a smaller "recent fights" widget.
 */
export function parseFighterFightHistory($: CheerioAPI): ParsedFighterHistoryEntry[] {
  const baseUrl = 'https://www.sherdog.com';
  const entries: ParsedFighterHistoryEntry[] = [];

  $('.module.fight_history')
    .first()
    .find('table.new_table.fighter tbody tr')
    .each((_, row) => {
      const $row = $(row);
      if ($row.hasClass('table_head')) return;

      const cells = $row.find('td');
      if (cells.length < 6) return;

      const result = cells.eq(0).find('.final_result').first().text().trim().toLowerCase();

      const opponentLink = cells.eq(1).find('a').first();
      const opponentName = opponentLink.text().trim();
      const opponentSherdogUrl = absoluteUrl(opponentLink.attr('href'), baseUrl);

      const eventCell = cells.eq(2);
      const eventLink = eventCell.find('a').first();
      const eventClone = eventLink.clone();
      eventClone.find('.sub_line').remove();
      const eventName = eventClone.text().trim();
      const eventSherdogUrl = absoluteUrl(eventLink.attr('href'), baseUrl);
      const date = normalizeHistoryDate(eventCell.find('.sub_line').first().text().trim());

      const methodCell = cells.eq(3);
      const method = methodCell.find('b').first().text().trim();
      const referee = methodCell.find('.sub_line').first().text().trim();

      const round = parseInt(cells.eq(4).text().trim(), 10) || 0;
      const time = cells.eq(5).text().trim();

      if (!opponentName || !eventName) return;

      entries.push({ opponentName, opponentSherdogUrl, eventName, eventSherdogUrl, date, result, method, referee, round, time });
    });

  return entries;
}

/** Maps the camelCase parser shape onto the snake_case shape written to data/scraped/*.json — shared by every scraper entry point that fetches a fighter page. */
export function toScrapedFightHistory(entries: ParsedFighterHistoryEntry[]): ScrapedFightHistoryEntry[] {
  return entries.map((entry) => ({
    opponent_name: entry.opponentName,
    opponent_sherdog_url: entry.opponentSherdogUrl,
    event_name: entry.eventName,
    event_sherdog_url: entry.eventSherdogUrl,
    date: entry.date,
    result: entry.result,
    method: entry.method,
    referee: entry.referee,
    round: entry.round,
    time: entry.time,
  }));
}

export function parseFighterDetails($: CheerioAPI): ParsedFighterDetails {
  const name = $('h1[itemprop="name"] span.fn').first().text().trim();
  const imageSrc = $('.fighter-info img[itemprop="image"]').first().attr('src') ?? '';
  const imageUrl = imageSrc ? absoluteUrl(imageSrc, 'https://www.sherdog.com') : '';
  const weightClass = $('.association-class a[href*="weightclass="]').first().text().trim();
  const wins = parseInt($('.winloses.win span').eq(1).text().trim(), 10) || 0;
  const losses = parseInt($('.winloses.lose span').eq(1).text().trim(), 10) || 0;
  const drawsText = $('.winloses.draw span').eq(1).text().trim();
  const draws = drawsText ? parseInt(drawsText, 10) || 0 : 0;
  const fightHistory = parseFighterFightHistory($);

  return { name, imageUrl, weightClass, wins, losses, draws, fightHistory };
}
