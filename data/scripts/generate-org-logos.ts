// data/scripts/generate-org-logos.ts
//
// Renders our own organization badges (abbreviation on a dark disc) into
// public/logos/<abbreviation>.png. These replace the logos that used to be
// hotlinked from ESPN's CDN: the files are ours, so there is no third-party
// image on the site. PNG rather than SVG because React Native's <Image>
// (mobile app) can't display SVG.
//
// Usage: npx tsx data/scripts/generate-org-logos.ts

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { organizations } from '../lib/placeholder-data';
import { orgLogoPath } from '../lib/org-logos';

const SIZE = 256;

function badgeHtml(label: string): string {
  // Long labels (OKTAGON, Bellator) get a smaller font to stay inside the disc.
  const fontSize = label.length <= 3 ? 96 : label.length <= 5 ? 64 : 44;
  return `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${SIZE}px;height:${SIZE}px;border-radius:50%;box-sizing:border-box;
      border:10px solid #ff3b30;background:#141414;display:flex;align-items:center;justify-content:center;
      font:700 ${fontSize}px/1 'Arial Narrow',Arial,sans-serif;letter-spacing:1px;color:#f5f5f5;text-transform:uppercase">
      ${label}
    </div></body></html>`;
}

async function main() {
  const outDir = path.resolve('public/logos');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  for (const org of organizations) {
    await page.setContent(badgeHtml(org.abbreviation));
    const file = path.join(path.resolve('public'), orgLogoPath(org.abbreviation));
    await page.screenshot({ path: file, omitBackground: true });
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
