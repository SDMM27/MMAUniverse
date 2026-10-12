// data/scrapers/sync-fighter-photos.ts
//
// Fills fighters.image_url with freely licensed photos only, plus the credit
// each license requires (photo_author / photo_license / ...), shown under the
// photo on the fighter page and on /credits-photos.
//
// Sherdog/ESPN photos are copyrighted, so they're no longer stored at all
// (the scrapers stopped writing image_url). Source here: Wikidata links a
// fighter's Sherdog ID (P2818) to his Wikimedia Commons image (P18) -- an
// exact match on the same sherdog_url we already have, no name guessing --
// then the Commons API gives a thumbnail plus author and license.
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

loadEnvLocal();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const sql = neon(process.env.DATABASE_URL);
const DRY_RUN = process.argv.includes('--dry-run');

// Wikimedia asks API clients to identify themselves with a contact.
const USER_AGENT = 'MMAUniverse/1.0 (mmauniverseapp@gmail.com)';
const THUMB_WIDTH = 800;
// Wikidata had ~1,200 Sherdog-linked fighters with a photo when this was
// written; far fewer back means a truncated/failed answer, not lost photos.
const MIN_WIKIDATA_ROWS = 800;

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

/** Sherdog fighter ID -> Commons file name, for every Wikidata item that has both. */
async function fetchWikidataFiles(): Promise<Map<string, string>> {
  const query = 'SELECT ?sherdog ?img WHERE { ?f wdt:P2818 ?sherdog ; wdt:P18 ?img . }';
  const data = await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  const rows = data.results.bindings as { sherdog: { value: string }; img: { value: string } }[];
  const files = new Map<string, string>();
  for (const row of rows) {
    const id = row.sherdog.value.match(/(\d+)\s*$/)?.[1];
    const file = decodeURIComponent(row.img.value.split('/Special:FilePath/')[1] ?? '');
    if (id && file && !files.has(id)) files.set(id, file);
  }
  return files;
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
  await sql`
    ALTER TABLE fighters
      ADD COLUMN IF NOT EXISTS photo_author TEXT,
      ADD COLUMN IF NOT EXISTS photo_author_url TEXT,
      ADD COLUMN IF NOT EXISTS photo_license TEXT,
      ADD COLUMN IF NOT EXISTS photo_license_url TEXT,
      ADD COLUMN IF NOT EXISTS photo_source_url TEXT
  `;

  const filesBySherdogId = await fetchWikidataFiles();
  if (filesBySherdogId.size < MIN_WIKIDATA_ROWS) {
    throw new Error(`Only ${filesBySherdogId.size} Wikidata rows (expected >= ${MIN_WIKIDATA_ROWS}); aborting without changes.`);
  }

  const fighters = (await sql`SELECT id, sherdog_url FROM fighters`) as { id: number; sherdog_url: string | null }[];
  const fileByFighter = new Map<number, string>();
  for (const f of fighters) {
    const file = filesBySherdogId.get(sherdogIdFromUrl(f.sherdog_url) ?? '');
    if (file) fileByFighter.set(f.id, file);
  }

  const photos = await fetchCommonsPhotos(Array.from(new Set(fileByFighter.values())));
  const matched = Array.from(fileByFighter).flatMap(([id, file]) => {
    const photo = photos.get(file);
    return photo ? [{ id, ...photo }] : [];
  });
  console.log(
    `${filesBySherdogId.size} Wikidata fighters with a photo; ${fileByFighter.size} of our ${fighters.length} fighters match; ${matched.length} with an allowed license.`,
  );
  if (DRY_RUN) {
    for (const m of matched.slice(0, 10)) console.log(`  #${m.id} ${m.file} — ${m.author} / ${m.license}`);
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

if (process.argv[1]?.includes('sync-fighter-photos')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
