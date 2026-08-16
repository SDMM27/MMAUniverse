// data/scrapers/run-all.ts
import fs from 'node:fs';
import path from 'node:path';
import { scrapeOrganization } from './sherdog';
import { ORG_CONFIGS } from './orgs.config';

const CACHE_DIR = path.resolve('data/scraped/.cache');
const OUTPUT_DIR = path.resolve('data/scraped');

async function main() {
  const requestedKey = process.argv[2];
  const configs = requestedKey ? ORG_CONFIGS.filter((c) => c.orgKey === requestedKey) : ORG_CONFIGS;

  if (requestedKey && configs.length === 0) {
    console.error(`Unknown org key "${requestedKey}". Expected one of: ${ORG_CONFIGS.map((c) => c.orgKey).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const config of configs) {
    console.log(`[${config.orgKey}] starting scrape...`);
    const data = await scrapeOrganization(config, CACHE_DIR);
    const outFile = path.join(OUTPUT_DIR, `${config.orgKey}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
    console.log(
      `[${config.orgKey}] wrote ${data.events.length} events, ${data.fighters.length} fighters, ${data.fights.length} fights to ${outFile}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
