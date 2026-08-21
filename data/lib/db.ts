import { neon } from '@neondatabase/serverless';

// Lazy singleton: `neon()` throws if DATABASE_URL isn't set yet, and Next.js
// evaluates top-level module code at build time (before Marketplace env vars
// are necessarily available). Deferring the call until the first query keeps
// `next build` safe.
let client: ReturnType<typeof neon<false, true>> | null = null;

function getClient() {
  if (!client) {
    // `fetchOptions: { cache: 'no-store' }` forces every underlying fetch()
    // this driver makes to opt out of Next.js's Data Cache. Route-level
    // `export const dynamic = 'force-dynamic'` (see app/seed/route.ts) only
    // opts a route out of static rendering — it does not, by itself, stop
    // Next from serving a cached response for an individual fetch() call
    // nested inside that route. Confirmed via diagnostic logging: repeated
    // `/seed` runs against a freshly truncated DB kept returning old ids
    // (e.g. a cached `SELECT id FROM events WHERE name = ...` result) with
    // zero real rows in the table, causing spurious fights_event_id_fkey
    // violations. no-store here is what actually prevents that.
    client = neon(process.env.DATABASE_URL!, { fullResults: true, fetchOptions: { cache: 'no-store' } });
  }
  return client;
}

// Thin wrapper matching the `@vercel/postgres` `sql<T>\`...\`` call shape
// (a generic tagged-template returning `{ rows: T[] }`) so call sites across
// the codebase didn't need to change when migrating off @vercel/postgres.
export function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<{ rows: T[] }> {
  return getClient()(strings, ...values) as unknown as Promise<{ rows: T[] }>;
}
