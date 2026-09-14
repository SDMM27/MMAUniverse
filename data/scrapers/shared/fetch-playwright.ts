// data/scrapers/shared/fetch-playwright.ts
//
// UFCStats.com sits behind a JS proof-of-work anti-bot challenge — a plain
// HTTP client (axios, see fetch-throttled.ts's fetchAndLoad, used for
// Sherdog) never gets past it, it just gets served the challenge page
// forever (confirmed empirically: curl with the same User-Agent as
// fetch-throttled.ts got a `Checking your browser…` shell every time). A
// real (headless) browser solves the challenge like any visitor's browser
// would, so this fetches through Playwright's Chromium instead of axios.
import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';

const DELAY_MS = 1500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One browser + one context reused across every call, not a fresh browser
// per page: the anti-bot challenge is solved once per context (it sets a
// session cookie) rather than re-solved on every single request.
async function getContext(): Promise<BrowserContext> {
  if (!context) {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ userAgent: USER_AGENT });
  }
  return context;
}

/** Fetches a URL through a headless browser (with a fixed delay since the previous request) and loads it into cheerio. */
export async function fetchAndLoadPW(url: string): Promise<cheerio.CheerioAPI> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < DELAY_MS) {
    await sleep(DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();

  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Tables render only once the anti-bot challenge resolves and the real
    // page takes over; swallow a timeout rather than throw so a genuinely
    // table-less page (an unusual/cancelled fight) doesn't kill the whole run.
    await page.waitForSelector('table', { timeout: 15000 }).catch(() => {});
    const html = await page.content();
    return cheerio.load(html);
  } finally {
    await page.close();
  }
}

/** Closes the shared browser. Call once at the end of a scrape run. */
export async function closeBrowser(): Promise<void> {
  await context?.close();
  await browser?.close();
  context = null;
  browser = null;
}
