// data/scrapers/sync-fighter-gender.ts
//
// Fills `fighters.is_women` (true / false / NULL = unknown), so a women's bout
// scraped from Sherdog as "Flyweight" can be shown as "Women's Flyweight"
// (displayWeightClass in data/lib/fight-utils.ts).
//
// Seeds: every fighter UFCStats has in a bout labelled with a division --
// "Women's ..." for women, any other division for men. The gender then spreads
// to everyone they fought, and so on, along the Sherdog fight histories
// (fighter_fight_history, keyed by Sherdog URL) -- see inferGenders.
//
// Recomputed from scratch on every run, in a few queries; daily-sync.yml runs
// it right after sync-fighter-history.ts so newly synced fighters get one.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { inferGenders, type Gender } from './shared/infer-gender';

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand
// (same few lines as sync-fighter-history.ts).
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

// Fighters without a Sherdog URL can still be seeds; they get a key of their own.
const keyOf = (row: { id: number; sherdog_url: string | null }) => row.sherdog_url ?? `id:${row.id}`;

async function main() {
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS is_women BOOLEAN`;

  const fighters = (await sql`SELECT id, sherdog_url FROM fighters`) as { id: number; sherdog_url: string | null }[];

  const seedRows = (await sql`
    SELECT f.id, f.sherdog_url, BOOL_OR(s.weight_class LIKE 'Women''s%') AS women, BOOL_OR(s.weight_class NOT LIKE 'Women''s%') AS men
    FROM fighter_fight_stats s
    JOIN fighters f ON f.id = s.fighter_id
    WHERE s.weight_class IS NOT NULL AND s.weight_class NOT IN ('Catch Weight', 'Open Weight')
    GROUP BY f.id, f.sherdog_url
  `) as { id: number; sherdog_url: string | null; women: boolean; men: boolean }[];
  const seeds = new Map<string, Gender>();
  for (const row of seedRows) {
    if (row.women === row.men) continue; // both (bad data) -- let the graph decide
    seeds.set(keyOf(row), row.women ? 'women' : 'men');
  }

  const edgeRows = (await sql`
    SELECT DISTINCT f.sherdog_url AS a, h.opponent_sherdog_url AS b
    FROM fighter_fight_history h
    JOIN fighters f ON f.id = h.fighter_id
    WHERE f.sherdog_url IS NOT NULL AND h.opponent_sherdog_url IS NOT NULL AND h.opponent_sherdog_url <> ''
  `) as { a: string; b: string }[];

  const genders = inferGenders(seeds, edgeRows.map((e) => [e.a, e.b] as [string, string]));

  const ids = fighters.map((f) => f.id);
  const values = fighters.map((f) => {
    const gender = genders.get(keyOf(f));
    return gender ? gender === 'women' : null;
  });
  await sql`
    UPDATE fighters f SET is_women = u.is_women
    FROM UNNEST(${ids}::int[], ${values}::boolean[]) AS u(id, is_women)
    WHERE f.id = u.id
  `;

  const women = values.filter((v) => v === true).length;
  const men = values.filter((v) => v === false).length;
  console.log(
    `Done. ${seeds.size} seed(s), ${edgeRows.length} fight edge(s): ${women} women, ${men} men, ${values.length - women - men} unknown, out of ${values.length} fighters.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
