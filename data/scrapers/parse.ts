// data/scrapers/parse.ts
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { normalizeDate, normalizeStartTime } from './shared/normalize-date';

export type FinalResult = 'win' | 'loss' | 'not_finished';

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

export function parseFighterDetails($: CheerioAPI): ParsedFighterDetails {
  const name = $('h1[itemprop="name"] span.fn').first().text().trim();
  const imageSrc = $('.fighter-info img[itemprop="image"]').first().attr('src') ?? '';
  const imageUrl = imageSrc ? absoluteUrl(imageSrc, 'https://www.sherdog.com') : '';
  const weightClass = $('.association-class a[href*="weightclass="]').first().text().trim();
  const wins = parseInt($('.winloses.win span').eq(1).text().trim(), 10) || 0;
  const losses = parseInt($('.winloses.lose span').eq(1).text().trim(), 10) || 0;
  const drawsText = $('.winloses.draw span').eq(1).text().trim();
  const draws = drawsText ? parseInt(drawsText, 10) || 0 : 0;

  return { name, imageUrl, weightClass, wins, losses, draws };
}
