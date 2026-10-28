// data/scripts/migrate-org-logos.ts
//
// One-off: points organizations.logo_link at our own badges in public/logos/
// (data/lib/org-logos.ts) instead of the ESPN-hosted images. Idempotent.
// Deploy the public/logos/ files before running this, or prod shows 404s.
//
// Usage: npx tsx data/scripts/migrate-org-logos.ts

import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

import { sql } from '../lib/db';
import { orgLogoPath } from '../lib/org-logos';

async function main() {
  const { rows } = await sql<{ id: number; abbreviation: string; logo_link: string }>`
    SELECT id, abbreviation, logo_link FROM organizations ORDER BY id
  `;
  for (const org of rows) {
    const next = orgLogoPath(org.abbreviation);
    if (org.logo_link === next) continue;
    await sql`UPDATE organizations SET logo_link = ${next} WHERE id = ${org.id}`;
    console.log(`${org.abbreviation}: ${org.logo_link} -> ${next}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
