import { neon } from '@neondatabase/serverless';

// Lazy singleton: `neon()` throws if DATABASE_URL isn't set yet, and Next.js
// evaluates top-level module code at build time (before Marketplace env vars
// are necessarily available). Deferring the call until the first query keeps
// `next build` safe.
let client: ReturnType<typeof neon<false, true>> | null = null;

function getClient() {
  if (!client) {
    client = neon(process.env.DATABASE_URL!, { fullResults: true });
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
