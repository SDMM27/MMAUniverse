// data/scrapers/sync-fighter-photos.ts
//
// Fills fighters.image_url with freely licensed photos only, plus the credit
// each license requires (photo_author / photo_license / ...), shown under the
// photo on the fighter page and on /credits-photos.
//
// Sherdog/ESPN photos are copyrighted, so they're no longer stored at all
// (the scrapers stopped writing image_url). Source here: Wikimedia Commons.
// One Wikidata SPARQL query lists the candidate MMA fighter items. Our
// fighters are matched to them, in order:
//   1. by Sherdog ID (P2818) -- exact, same sherdog_url we already have;
//   2. fallback, only for fighters left unmatched: normalized name + exact
//      birth date, accepted only when that (name, date) pair is unique on both
//      sides (one Wikidata item AND one of our fighters). Never on name alone,
//      and never against an item whose Sherdog ID differs from ours.
// The photo is the item's Commons image (P18) or, failing that, the lead image
// of its Wikipedia article (page_image_free only, never the fair-use
// page_image). Either way the file goes through the Commons API, which gives a
// thumbnail plus author and license; files not hosted on Commons are skipped.
// Only public domain / CC0 / CC BY / CC BY-SA are kept (no NC, no ND: the
// photos get cropped and the site may not stay non-commercial forever).
//
// Fighters without a free photo get image_url = NULL, i.e. the silhouette.
// A Wikidata/Commons outage aborts before touching the table, so a failed
// run never wipes the photos.
//
// Usage: npx tsx data/scrapers/sync-fighter-photos.ts [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { normalizeFighterName } from './ranking-name-match';

// Duplicated from sync-fighter-history.ts rather than shared — see that file's own note on why.
function loadEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

// Wikimedia asks API clients to identify themselves with a contact.
const USER_AGENT = 'MMAUniverse/1.0 (mmauniverseapp@gmail.com)';
const THUMB_WIDTH = 800;
// Wikidata had ~1,200 items with both a Sherdog ID and a P18 photo when this
// was written; far fewer back means a truncated/failed answer, not lost photos.
const MIN_WIKIDATA_ROWS = 800;

// Hand-picked fixes to Wikidata's choice, by Sherdog fighter ID: another
// Commons file, or null for no photo. For pictures that are free but wrong
// for a fighter card (a politician in the frame, a group shot...).
const PHOTO_OVERRIDES: Record<string, string | null> = {
  '186873': 'PetrYan (cropped).jpg', // Petr Yan: Wikidata's photo is with Putin at the Kremlin
};

const ALLOWED_LICENSE = /^(cc0|public domain|pd\b|pd-|cc by(-sa)? \d(\.\d)?)/i;

export type CommonsPhoto = {
  file: string;
  imageUrl: string;
  author: string;
  authorUrl: string | null;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

export function sherdogIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(/-(\d+)\/?$/)?.[1] ?? url?.match(/(\d+)\/?$/)?.[1] ?? null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// Commons' Artist field is HTML: usually one <a> to the user/author page,
// sometimes free text or a whole table. Keep the plain text (capped) and the
// first link, made absolute; a red link (page doesn't exist) isn't worth one.
export function parseArtist(html: string): { author: string; authorUrl: string | null } {
  const text = decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\(\s*(talk|discussion)\s*\)/gi, '').replace(/\s+/g, ' ').trim();
  const author = text.length > 80 ? `${text.slice(0, 77)}…` : text;
  const anchor = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>/i);
  let authorUrl: string | null = null;
  if (anchor && !/class="new"/.test(anchor[0])) {
    const href = decodeEntities(anchor[1]);
    authorUrl = href.startsWith('//') ? `https:${href}` : href.startsWith('/') ? `https://commons.wikimedia.org${href}` : href;
  }
  return { author, authorUrl };
}

function stripTracking(url: string): string {
  return url.replace(/\?utm_[^#]*$/, '');
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) } });
    if (res.ok) return res.json();
    if (attempt >= 3 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} on ${url.slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

export type WikidataItem = {
  qid: string;
  sherdogIds: Set<string>;
  /** P18 Commons file names, first one wins. */
  files: string[];
  /** YYYY-MM-DD, only when the item has a single distinct P569 day. */
  birthDate: string | null;
  /** Normalized labels (normalizeFighterName). */
  names: Set<string>;
  articles: { lang: string; title: string }[];
};

type SparqlValue = { value: string };
export type SparqlRow = {
  f: SparqlValue;
  sherdog?: SparqlValue;
  img?: SparqlValue;
  dob?: SparqlValue;
  name?: SparqlValue;
  article?: SparqlValue;
};

// Wikipedia editions to look at, in priority order for the lead image.
const WIKI_LANGS = ['en', 'fr', 'pt', 'es', 'ru', 'ja'];

const WIKIDATA_QUERY = `SELECT ?f ?sherdog ?img ?dob ?name ?article WHERE {
 { ?f wdt:P2818 ?x } UNION { ?f wdt:P9722 ?x } UNION { ?f wdt:P9728 ?x } UNION { ?f wdt:P10073 ?x } UNION { ?f wdt:P106 wd:Q11607585 }
 OPTIONAL { ?f wdt:P2818 ?sherdog } OPTIONAL { ?f wdt:P18 ?img } OPTIONAL { ?f wdt:P569 ?dob }
 OPTIONAL { ?f rdfs:label ?name FILTER(LANG(?name) IN ("en","fr","pt","es","de")) }
 OPTIONAL { ?article schema:about ?f ; schema:isPartOf ?wiki . FILTER(?wiki IN (${WIKI_LANGS.map((l) => `<https://${l}.wikipedia.org/>`).join(', ')})) }
}`;

/** 'https://en.wikipedia.org/wiki/Foo_Bar' -> { lang: 'en', title: 'Foo Bar' } */
export function parseArticleUrl(url: string): { lang: string; title: string } | null {
  const m = url.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (!m) return null;
  let title: string;
  try {
    title = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  return { lang: m[1].toLowerCase(), title: title.replace(/_/g, ' ') };
}

/** Folds the SPARQL cross-product rows back into one object per Wikidata item. */
export function aggregateWikidataRows(rows: SparqlRow[]): WikidataItem[] {
  const items = new Map<string, WikidataItem & { dobs: Set<string> }>();
  for (const row of rows) {
    const qid = row.f.value.split('/').pop() ?? '';
    if (!qid) continue;
    let item = items.get(qid);
    if (!item) {
      item = { qid, sherdogIds: new Set(), files: [], birthDate: null, names: new Set(), articles: [], dobs: new Set() };
      items.set(qid, item);
    }
    const sherdog = row.sherdog?.value.match(/(\d+)\s*$/)?.[1];
    if (sherdog) item.sherdogIds.add(sherdog);
    if (row.img) {
      let file = '';
      try {
        file = decodeURIComponent(row.img.value.split('/Special:FilePath/')[1] ?? '');
      } catch {
        // malformed percent-encoding: no usable file name
      }
      if (file && !item.files.includes(file)) item.files.push(file);
    }
    const day = row.dob?.value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (day) item.dobs.add(day);
    if (row.name) {
      const name = normalizeFighterName(row.name.value);
      if (name) item.names.add(name);
    }
    const article = row.article ? parseArticleUrl(row.article.value) : null;
    if (article && !item.articles.some((a) => a.lang === article.lang && a.title === article.title)) item.articles.push(article);
  }
  return Array.from(items.values()).map(({ dobs, ...item }) => ({ ...item, birthDate: dobs.size === 1 ? Array.from(dobs)[0] : null }));
}

async function fetchWikidataItems(): Promise<WikidataItem[]> {
  const data = await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(WIKIDATA_QUERY)}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  return aggregateWikidataRows(data.results.bindings as SparqlRow[]);
}

export type OurFighter = { id: number; name: string; sherdog_url: string | null; birth_date: string | Date | null };
export type MatchMethod = 'sherdog' | 'name+dob';
export type FighterMatch = { item: WikidataItem; method: MatchMethod };

/** Our birth_date as YYYY-MM-DD (strings are cut, Dates read in UTC), or null. */
export function toIsoDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/**
 * Pairs our fighters with Wikidata items. Sherdog ID first; then name + exact
 * birth date for the rest, only when that pair is unique among the items and
 * among our fighters. Each fighter is matched at most once; an item can go to
 * several rows sharing its Sherdog ID, but to only one name + date match.
 */
export function matchFighters(fighters: OurFighter[], items: WikidataItem[]): Map<number, FighterMatch> {
  const matches = new Map<number, FighterMatch>();
  const usedItems = new Set<string>();

  const itemsBySherdog = new Map<string, WikidataItem[]>();
  for (const item of items) {
    for (const id of Array.from(item.sherdogIds)) itemsBySherdog.set(id, [...(itemsBySherdog.get(id) ?? []), item]);
  }
  for (const f of fighters) {
    const id = sherdogIdFromUrl(f.sherdog_url);
    const candidates = id ? itemsBySherdog.get(id) : undefined;
    if (!candidates?.length) continue;
    // No "already used" check here: one person can have several rows (one per
    // organization) sharing the same sherdog_url, and each row gets the photo.
    const item = candidates.find((c) => c.files.length > 0) ?? candidates[0];
    matches.set(f.id, { item, method: 'sherdog' });
    usedItems.add(item.qid);
  }

  const keyOf = (name: string, day: string) => `${name}|${day}`;
  const itemsByKey = new Map<string, WikidataItem[]>();
  for (const item of items) {
    if (!item.birthDate) continue;
    for (const name of Array.from(item.names)) {
      const key = keyOf(name, item.birthDate);
      itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), item]);
    }
  }
  const fighterKeys = new Map<number, string | null>();
  const fightersPerKey = new Map<string, number>();
  for (const f of fighters) {
    const day = toIsoDay(f.birth_date);
    const name = normalizeFighterName(f.name);
    const key = day && name ? keyOf(name, day) : null;
    fighterKeys.set(f.id, key);
    if (key) fightersPerKey.set(key, (fightersPerKey.get(key) ?? 0) + 1);
  }
  for (const f of fighters) {
    if (matches.has(f.id)) continue;
    const key = fighterKeys.get(f.id);
    if (!key || fightersPerKey.get(key) !== 1) continue;
    const candidates = itemsByKey.get(key);
    if (candidates?.length !== 1) continue;
    const item = candidates[0];
    if (usedItems.has(item.qid)) continue;
    // An item with another Sherdog ID is another person.
    const ourSherdog = sherdogIdFromUrl(f.sherdog_url);
    if (ourSherdog && item.sherdogIds.size > 0 && !item.sherdogIds.has(ourSherdog)) continue;
    matches.set(f.id, { item, method: 'name+dob' });
    usedItems.add(item.qid);
  }
  return matches;
}

export type PhotoSource = 'override' | 'P18' | 'wikipedia';

/**
 * Override (by Sherdog ID) then P18. `final: false` means nothing decided it,
 * so the Wikipedia lead image may be tried.
 */
export function pickKnownFile(sherdogIds: string[], item: WikidataItem): { file: string | null; source: PhotoSource | null; final: boolean } {
  for (const id of sherdogIds) {
    if (id in PHOTO_OVERRIDES) {
      const file = PHOTO_OVERRIDES[id];
      return { file, source: file ? 'override' : null, final: true };
    }
  }
  if (item.files.length > 0) return { file: item.files[0], source: 'P18', final: true };
  return { file: null, source: null, final: false };
}

/**
 * Maps a pageprops/page_image_free API answer back to the titles we asked
 * for, following `normalized` then `redirects`.
 */
export function mapWikiPageImages(data: any, requested: string[]): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const n of data?.query?.normalized ?? []) normalized.set(n.from, n.to);
  const redirects = new Map<string, string>();
  for (const r of data?.query?.redirects ?? []) redirects.set(r.from, r.to);
  const imageByTitle = new Map<string, string>();
  for (const page of data?.query?.pages ?? []) {
    const image = page.pageprops?.page_image_free;
    if (typeof image === 'string' && image) imageByTitle.set(page.title, image);
  }
  const out = new Map<string, string>();
  for (const title of requested) {
    let current = normalized.get(title) ?? title;
    current = redirects.get(current) ?? current;
    const image = imageByTitle.get(current);
    if (image) out.set(title, image);
  }
  return out;
}

/** qid -> Commons file name (lead image of the first wiki, in WIKI_LANGS order, that has one). */
async function fetchWikipediaImages(items: WikidataItem[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const lang of WIKI_LANGS) {
    const pending = items.flatMap((item) => {
      const article = item.articles.find((a) => a.lang === lang);
      return !result.has(item.qid) && article && !article.title.includes('|') ? [{ qid: item.qid, title: article.title }] : [];
    });
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);
      // POST keeps the URL short whatever the titles look like.
      const body = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'pageprops',
        ppprop: 'page_image_free',
        redirects: '1',
        titles: batch.map((b) => b.title).join('|'),
      });
      const data = await fetchJson(`https://${lang}.wikipedia.org/w/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const images = mapWikiPageImages(data, batch.map((b) => b.title));
      for (const b of batch) {
        const image = images.get(b.title);
        if (image && !result.has(b.qid)) result.set(b.qid, image);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return result;
}

async function fetchCommonsPhotos(files: string[]): Promise<Map<string, CommonsPhoto>> {
  const photos = new Map<string, CommonsPhoto>();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl',
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    // Commons normalizes titles (underscores, first letter); map them back.
    const original = new Map<string, string>();
    for (const n of data.query.normalized ?? []) original.set(n.to, n.from);
    for (const page of data.query.pages ?? []) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata;
      if (!info || !meta) continue;
      const license = decodeEntities(meta.LicenseShortName?.value ?? '').trim();
      if (!ALLOWED_LICENSE.test(license)) continue;
      const { author, authorUrl } = parseArtist(meta.Artist?.value ?? meta.Credit?.value ?? '');
      const file = (original.get(page.title) ?? page.title).replace(/^File:/, '');
      photos.set(file, {
        file,
        imageUrl: stripTracking(info.thumburl ?? info.url),
        author: author || 'Auteur inconnu',
        authorUrl,
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        sourceUrl: info.descriptionurl,
      });
    }
  }
  return photos;
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const sql = neon(process.env.DATABASE_URL);

  // Commons thumbnail URLs (long, percent-encoded file names) overflow the
  // original VARCHAR(255).
  await sql`
    ALTER TABLE fighters
      ALTER COLUMN image_url TYPE TEXT,
      ADD COLUMN IF NOT EXISTS photo_author TEXT,
      ADD COLUMN IF NOT EXISTS photo_author_url TEXT,
      ADD COLUMN IF NOT EXISTS photo_license TEXT,
      ADD COLUMN IF NOT EXISTS photo_license_url TEXT,
      ADD COLUMN IF NOT EXISTS photo_source_url TEXT
  `;

  const items = await fetchWikidataItems();
  const withSherdogPhoto = items.filter((i) => i.sherdogIds.size > 0 && i.files.length > 0).length;
  if (withSherdogPhoto < MIN_WIKIDATA_ROWS) {
    throw new Error(`Only ${withSherdogPhoto} Wikidata items with a Sherdog ID and a photo (expected >= ${MIN_WIKIDATA_ROWS}); aborting without changes.`);
  }

  // birth_date::text so the date never goes through a timezone-dependent Date.
  const fighters = (await sql`SELECT id, name, sherdog_url, birth_date::text AS birth_date FROM fighters`) as OurFighter[];
  const matches = matchFighters(fighters, items);
  const methodCounts: Record<MatchMethod, number> = { sherdog: 0, 'name+dob': 0 };
  for (const m of Array.from(matches.values())) methodCounts[m.method]++;

  // Photo choice per matched fighter: override, P18, else Wikipedia lead image.
  const choice = new Map<number, { file: string; source: PhotoSource }>();
  const needWikipedia = new Map<string, WikidataItem>();
  for (const f of fighters) {
    const match = matches.get(f.id);
    if (!match) continue;
    const ids = [sherdogIdFromUrl(f.sherdog_url), ...Array.from(match.item.sherdogIds)].filter((x): x is string => !!x);
    const known = pickKnownFile(ids, match.item);
    if (known.file && known.source) choice.set(f.id, { file: known.file, source: known.source });
    else if (!known.final && match.item.articles.length > 0) needWikipedia.set(match.item.qid, match.item);
  }
  const wikiImages = await fetchWikipediaImages(Array.from(needWikipedia.values()));
  for (const f of fighters) {
    const match = matches.get(f.id);
    const file = match && !choice.has(f.id) ? wikiImages.get(match.item.qid) : undefined;
    if (file) choice.set(f.id, { file, source: 'wikipedia' });
  }

  const photos = await fetchCommonsPhotos(Array.from(new Set(Array.from(choice.values(), (c) => c.file))));
  const nameById = new Map(fighters.map((f) => [f.id, f.name]));
  const matched = Array.from(choice).flatMap(([id, c]) => {
    const photo = photos.get(c.file);
    return photo ? [{ id, source: c.source, ...photo }] : [];
  });
  const sourceCounts: Record<PhotoSource, number> = { override: 0, P18: 0, wikipedia: 0 };
  for (const m of matched) sourceCounts[m.source]++;
  console.log(
    `${items.length} Wikidata items (${withSherdogPhoto} with Sherdog ID + photo); ${matches.size} of our ${fighters.length} fighters match ` +
      `(sherdog ${methodCounts.sherdog}, name+dob ${methodCounts['name+dob']}); ${matched.length} with an allowed license ` +
      `(override ${sourceCounts.override}, P18 ${sourceCounts.P18}, wikipedia ${sourceCounts.wikipedia}).`,
  );
  if (DRY_RUN) {
    for (const m of matched.slice(0, 10)) console.log(`  #${m.id} ${m.file} — ${m.author} / ${m.license}`);
    console.log('name+dob matches:');
    for (const [id, m] of Array.from(matches).filter(([, m]) => m.method === 'name+dob').slice(0, 10)) {
      console.log(`  #${id} ${nameById.get(id)} -> ${m.item.qid}`);
    }
    console.log('wikipedia-sourced photos:');
    for (const m of matched.filter((x) => x.source === 'wikipedia').slice(0, 10)) {
      console.log(`  #${m.id} ${nameById.get(m.id)} -> ${m.file} — ${m.license}`);
    }
    return;
  }

  // One-off safety net for the switch away from Sherdog photos: the first
  // real run keeps the old URLs aside (never displayed), so it can be undone.
  await sql`
    CREATE TABLE IF NOT EXISTS fighters_image_backup AS
    SELECT id AS fighter_id, image_url, now() AS backed_up_at FROM fighters
    WHERE image_url IS NOT NULL AND image_url NOT LIKE '%wikimedia.org%'
  `;

  const ids = matched.map((m) => m.id);
  await sql`
    UPDATE fighters SET image_url = NULL, photo_author = NULL, photo_author_url = NULL,
      photo_license = NULL, photo_license_url = NULL, photo_source_url = NULL
    WHERE (image_url IS NOT NULL OR photo_author IS NOT NULL) AND id <> ALL(${ids}::int[])
  `;
  await sql`
    UPDATE fighters f SET image_url = u.image_url, photo_author = u.author, photo_author_url = u.author_url,
      photo_license = u.license, photo_license_url = u.license_url, photo_source_url = u.source_url
    FROM UNNEST(
      ${ids}::int[], ${matched.map((m) => m.imageUrl)}::text[], ${matched.map((m) => m.author)}::text[],
      ${matched.map((m) => m.authorUrl)}::text[], ${matched.map((m) => m.license)}::text[],
      ${matched.map((m) => m.licenseUrl)}::text[], ${matched.map((m) => m.sourceUrl)}::text[]
    ) AS u(id, image_url, author, author_url, license, license_url, source_url)
    WHERE f.id = u.id
  `;
  console.log(`Done. ${matched.length} fighters with a free photo; every other fighter shows the silhouette.`);
}

// Not when imported (tests): the test file name contains "sync-fighter-photos" too.
if (/sync-fighter-photos\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
