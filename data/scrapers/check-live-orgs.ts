// data/scrapers/check-live-orgs.ts
//
// Event-day gate for the frequent-polling workflow: prints (space-separated, to stdout) the
// orgKeys that have an event scheduled for today, so the workflow can skip the Sherdog fetch
// entirely on quiet days and, on a live day, only rescrape the org(s) actually fighting
// tonight instead of the whole roster. Prints nothing (exit 0) when no org has an event today.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { ORG_CONFIGS } from './orgs.config';

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand.
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
    // `vercel env pull` wraps every value in double quotes; strip a single
    // matching pair so DATABASE_URL etc. don't end up with literal quote
    // characters baked into them.
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

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = (await sql`
    SELECT DISTINCT organization_id FROM events WHERE date = ${today}
  `) as { organization_id: number }[];

  const idToKey = new Map(ORG_CONFIGS.map((c) => [c.organizationId, c.orgKey]));
  const orgKeys = rows.map((r) => idToKey.get(r.organization_id)).filter((key): key is string => Boolean(key));

  // Space-separated on stdout, nothing else — the workflow captures this directly into a
  // matrix/list. Diagnostics go to stderr via console.error so they don't pollute stdout.
  console.error(orgKeys.length > 0 ? `Live today: ${orgKeys.join(', ')}` : 'No event today.');
  process.stdout.write(orgKeys.join(' '));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
