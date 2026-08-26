// Sherdog's fighter photo URLs bake the requested resolution into the path itself,
// e.g. https://www.sherdog.com/image_crop/200/300/_images/fighter/xyz.jpg — the
// scraper (data/scrapers/parse.ts) stores whatever size Sherdog's own profile page
// happens to request (200x300), which is too small to display at anything above a
// thumbnail without visible upscaling artifacts.
//
// Requesting a larger crop from the same URL returns genuinely more detail (verified
// against Sherdog live: 200x300 -> 44KB, 800x1200 -> 331KB, scaling roughly with pixel
// count rather than plateauing the way a naive upscale would) up to a cap somewhere
// around 1600x2400, beyond which the endpoint starts erroring. This rewrites a stored
// image_crop URL to ask for a sharper version at render time, without needing to
// re-scrape or touch the stored value.
const IMAGE_CROP_PATTERN = /\/image_crop\/\d+\/\d+\//;

export function withHigherResolution(url: string, width = 400, height = 600): string {
  if (!IMAGE_CROP_PATTERN.test(url)) return url;
  return url.replace(IMAGE_CROP_PATTERN, `/image_crop/${width}/${height}/`);
}
