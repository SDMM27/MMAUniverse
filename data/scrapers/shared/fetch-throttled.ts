// data/scrapers/shared/fetch-throttled.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

const DELAY_MS = 1500;
const USER_AGENT = 'MMA-Universe-DataScraper/1.0 (research/hobby project; contact: donsacha27@gmail.com)';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

/** Fetches a URL (with a fixed delay since the previous request) and loads it into cheerio. */
export async function fetchAndLoad(url: string): Promise<cheerio.CheerioAPI> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < DELAY_MS) {
    await sleep(DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();

  const response = await axios.get<string>(url, { headers: { 'User-Agent': USER_AGENT } });
  return cheerio.load(response.data);
}
