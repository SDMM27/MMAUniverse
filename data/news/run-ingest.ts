// data/news/run-ingest.ts
import fs from 'node:fs';
import path from 'node:path';
import { ingestAllSources } from './fetch-news';

// tsx doesn't auto-load .env.local the way Next.js does — same hand-rolled
// loader as data/scrapers/sync-ufc-rankings.ts. In GitHub Actions, DATABASE_URL
// is already set via secrets.DATABASE_URL, so this is a no-op there.
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

async function main() {
  const results = await ingestAllSources();
  console.log(JSON.stringify(results, null, 2));

  const allFailed = results.length > 0 && results.every((r) => r.error !== null);
  if (allFailed) {
    console.error('All news sources failed to ingest.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
