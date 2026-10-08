// data/scrapers/dedupe-seed-duplicates.ts
//
// One-time cleanup for duplicate rows created by re-running data/scripts/seed-db.ts
// before it was fixed to be idempotent (see the comments in seedEvents /
// seedFighters / getFighterIdByName there). Symptom: duplicate events in
// listings, and the same fight card rendered twice on an event page.
//
// Root cause: every /seed run re-inserted every event and every fighter
// (their ON CONFLICT (id) DO NOTHING never matched, since `id` was always a
// fresh SERIAL value). Once an event name had duplicate rows, seedFights'
// `getEventIdByName` could resolve to a different row on each run; same for
// fighter names via `getFighterIdByName`. Either way, seedFights' (event_id,
// fighter1_id, fighter2_id) dedup key stopped matching the previously-
// inserted fight — leaving both the old row and a new duplicate behind.
//
// This script:
//   1. Merges duplicate events (same name — the key getEventIdByName uses)
//      into the earliest (lowest id) row, repointing every fights.event_id
//      that pointed at a duplicate before deleting the duplicate rows. Runs
//      before every fight-dedup step below, since those all partition by
//      event_id and would otherwise treat fights on unmerged duplicate
//      events as distinct.
//   2. Merges duplicate fighters (same name + organization_id) into the
//      earliest (lowest id) row, repointing every fights/picks foreign key
//      that pointed at a duplicate before deleting the duplicate rows.
//   3. Removes duplicate fight rows for the same (event_id, fighter pair)
//      once fighter ids are merged, keeping the most complete row (finished
//      result over unfinished, then lowest id).
//   4. Removes broken fight rows with a NULL fighter1_id/fighter2_id, but
//      only when a complete duplicate for the same event + known fighter
//      already exists — a null-sided row with no such counterpart is left
//      alone and reported, since deleting it could lose a real fixture.
//   5. Collapses null-sided rows that duplicate *each other* — same event_id
//      and same (fighter1_id, fighter2_id) pair, NULLs included, since
//      Postgres groups NULLs together in PARTITION BY/GROUP BY (unlike `=`
//      in a WHERE clause). This is the seedFights counterpart to step 2:
//      before its DELETE was fixed to use IS NOT DISTINCT FROM (see
//      data/scripts/seed-db.ts), every /seed re-run added one more copy of every
//      fight whose fighter name never resolves — 6 pre-fix runs turned ~30
//      unresolvable fights into 180 rows. Keeps the lowest id per group.
//
// Defaults to a dry run that only reports counts. Pass --apply to commit.
//
//   npx tsx data/scrapers/dedupe-seed-duplicates.ts          # dry run
//   npx tsx data/scrapers/dedupe-seed-duplicates.ts --apply  # actually delete

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand
// (same as data/scrapers/sync-upcoming-to-db.ts).
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

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (expected in .env.local)');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes('--apply');

// The (name, organization_id) -> (dup_id, keep_id) mapping this needs is
// recomputed fresh inside every statement below via the same WITH clause,
// rather than once in JS and looped over per group. With ~6,700 duplicate
// groups, looping meant ~6 sequential round trips per group — at Neon's
// observed ~110ms/round-trip that's over an hour for what these joins let
// Postgres do server-side in 4 statements total. The WITH clause is safe to
// repeat across statements: `fighters` doesn't change until the very last
// (DELETE) statement runs, so `groups`/`dupes` resolve identically each time.
const dupesCte = `
  WITH groups AS (
    SELECT name, organization_id, MIN(id) AS keep_id
    FROM fighters
    GROUP BY name, organization_id
    HAVING COUNT(*) > 1
  ),
  dupes AS (
    SELECT f.id AS dup_id, g.keep_id AS keep_id
    FROM fighters f
    JOIN groups g ON f.name = g.name AND f.organization_id = g.organization_id
    WHERE f.id <> g.keep_id
  )
`;

async function mergeDuplicateEvents() {
  // Same root cause as fighters (see mergeDuplicateFighters below), but in
  // seedEvents: `ON CONFLICT (id) DO NOTHING` never fired since `id` was
  // never supplied on INSERT, and there was no UNIQUE constraint on `name`
  // either. Every /seed re-run duplicated the entire events table. Keyed by
  // name alone (not name+organization_id) because that's the only key
  // getEventIdByName uses to resolve a fight's event_id, so it's the key that
  // actually matters for merging fights.event_id correctly.
  const groups = (await sql`
    SELECT name, MIN(id) AS keep_id, COUNT(*) AS c
    FROM events
    GROUP BY name
    HAVING COUNT(*) > 1
  `) as { name: string; keep_id: number; c: string }[];

  const extraRows = groups.reduce((sum, g) => sum + (Number(g.c) - 1), 0);
  console.log(`Events: ${groups.length} duplicate name groups, ${extraRows} extra rows to remove.`);

  if (!apply || groups.length === 0) return;

  const eventDupesCte = `
    WITH groups AS (
      SELECT name, MIN(id) AS keep_id
      FROM events
      GROUP BY name
      HAVING COUNT(*) > 1
    ),
    dupes AS (
      SELECT e.id AS dup_id, g.keep_id AS keep_id
      FROM events e
      JOIN groups g ON e.name = g.name
      WHERE e.id <> g.keep_id
    )
  `;

  await sql.query(`${eventDupesCte} UPDATE fights SET event_id = dupes.keep_id FROM dupes WHERE fights.event_id = dupes.dup_id`);
  const deleted = await sql.query(`${eventDupesCte} DELETE FROM events USING dupes WHERE events.id = dupes.dup_id RETURNING events.id`);
  console.log(`Events: merged ${groups.length} groups, removed ${(deleted as unknown as { id: number }[]).length} rows.`);
}

async function mergeDuplicateFighters() {
  const groups = (await sql`
    SELECT name, organization_id, MIN(id) AS keep_id, COUNT(*) AS c
    FROM fighters
    GROUP BY name, organization_id
    HAVING COUNT(*) > 1
  `) as { name: string; organization_id: number; keep_id: number; c: string }[];

  const extraRows = groups.reduce((sum, g) => sum + (Number(g.c) - 1), 0);
  console.log(`Fighters: ${groups.length} duplicate (name, organization_id) groups, ${extraRows} extra rows to remove.`);

  if (!apply || groups.length === 0) return;

  await sql.query(`${dupesCte} UPDATE fights SET fighter1_id = dupes.keep_id FROM dupes WHERE fights.fighter1_id = dupes.dup_id`);
  await sql.query(`${dupesCte} UPDATE fights SET fighter2_id = dupes.keep_id FROM dupes WHERE fights.fighter2_id = dupes.dup_id`);
  await sql.query(`${dupesCte} UPDATE fights SET winner_id = dupes.keep_id FROM dupes WHERE fights.winner_id = dupes.dup_id`);
  await sql.query(`${dupesCte} UPDATE picks SET predicted_winner_id = dupes.keep_id FROM dupes WHERE picks.predicted_winner_id = dupes.dup_id`);
  const deleted = await sql.query(`${dupesCte} DELETE FROM fighters USING dupes WHERE fighters.id = dupes.dup_id RETURNING fighters.id`);
  console.log(`Fighters: merged ${groups.length} groups, removed ${(deleted as unknown as { id: number }[]).length} rows.`);
}

async function dedupeExactFightRows() {
  // Joins through to fighters and dedupes by (name, organization_id) rather
  // than raw fighter1_id/fighter2_id: two logically-identical fights can
  // still point at different duplicate fighter rows if this runs before (or
  // without) mergeDuplicateFighters, e.g. in a dry run. Matching by identity
  // instead of id keeps the count accurate either way.
  const ranked = (await sql`
    SELECT id, rn FROM (
      SELECT f.id,
        ROW_NUMBER() OVER (
          PARTITION BY f.event_id,
            LEAST(f1.name || '|' || f1.organization_id, f2.name || '|' || f2.organization_id),
            GREATEST(f1.name || '|' || f1.organization_id, f2.name || '|' || f2.organization_id)
          ORDER BY f.fight_finished DESC NULLS LAST, (f.winner_id IS NOT NULL) DESC, f.id ASC
        ) AS rn
      FROM fights f
      JOIN fighters f1 ON f.fighter1_id = f1.id
      JOIN fighters f2 ON f.fighter2_id = f2.id
    ) t
    WHERE rn > 1
  `) as { id: number; rn: number }[];

  console.log(`Fights: ${ranked.length} duplicate rows (same event + fighter pair) to remove.`);

  if (!apply || ranked.length === 0) return;

  const ids = ranked.map((r) => r.id);
  await sql`DELETE FROM fights WHERE id = ANY(${ids})`;
  console.log(`Fights: removed ${ids.length} duplicate rows.`);
}

async function dedupeNullSidedFightRows() {
  // Same identity-based matching as dedupeExactFightRows: compares the known
  // side by (name, organization_id) rather than raw id, so this still finds
  // a match even when the known fighter is itself an unmerged duplicate row.
  const broken = (await sql`
    SELECT f.id FROM fights f
    JOIN fighters fk ON fk.id = COALESCE(f.fighter1_id, f.fighter2_id)
    WHERE (f.fighter1_id IS NULL OR f.fighter2_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM fights g
      JOIN fighters g1 ON g.fighter1_id = g1.id
      JOIN fighters g2 ON g.fighter2_id = g2.id
      WHERE g.event_id = f.event_id
        AND g.id <> f.id
        AND (fk.name, fk.organization_id) IN ((g1.name, g1.organization_id), (g2.name, g2.organization_id))
    )
  `) as { id: number }[];

  const [{ count: totalNullSided }] = (await sql`
    SELECT COUNT(*) FROM fights WHERE fighter1_id IS NULL OR fighter2_id IS NULL
  `) as { count: string }[];

  console.log(
    `Fights: ${totalNullSided} rows have a NULL fighter1_id/fighter2_id; ` +
      `${broken.length} of those have a complete duplicate for the same event and will be removed. ` +
      `${Number(totalNullSided) - broken.length} have no complete counterpart and are left untouched — review those manually.`,
  );

  if (!apply || broken.length === 0) return;

  const ids = broken.map((b) => b.id);
  await sql`DELETE FROM fights WHERE id = ANY(${ids})`;
  console.log(`Fights: removed ${ids.length} broken null-sided rows.`);
}

async function dedupeNullSidedRowsAgainstEachOther() {
  // PARTITION BY groups NULLs together (unlike `=` in a WHERE clause), so
  // this correctly finds e.g. 6 rows that are all (event_id: 430,
  // fighter1_id: 1516, fighter2_id: NULL) as one group of duplicates.
  const ranked = (await sql`
    SELECT id, rn FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY event_id, fighter1_id, fighter2_id
          ORDER BY id ASC
        ) AS rn
      FROM fights
      WHERE fighter1_id IS NULL OR fighter2_id IS NULL
    ) t
    WHERE rn > 1
  `) as { id: number; rn: number }[];

  console.log(`Fights: ${ranked.length} null-sided rows duplicate another null-sided row for the same event/fighter and will be collapsed.`);

  if (!apply || ranked.length === 0) return;

  const ids = ranked.map((r) => r.id);
  await sql`DELETE FROM fights WHERE id = ANY(${ids})`;
  console.log(`Fights: removed ${ids.length} duplicate null-sided rows.`);
}

async function main() {
  console.log(apply ? 'Running in APPLY mode — changes will be committed.\n' : 'Running in DRY-RUN mode — pass --apply to commit changes.\n');

  // Events merge first: dedupeExactFightRows/dedupeNullSidedFightRows below
  // both partition by fights.event_id, so duplicate events left unmerged
  // would hide fights that are otherwise identical duplicates of each other
  // (each pointing at a different duplicate event row).
  await mergeDuplicateEvents();
  await mergeDuplicateFighters();
  await dedupeExactFightRows();
  await dedupeNullSidedFightRows();
  await dedupeNullSidedRowsAgainstEachOther();

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to make these changes.');
  } else {
    console.log('\nDone.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
