// app/classement/page.tsx
import { fetchAllTimeLeaderboard } from '@/data/lib/picks-data';
import { OctBadge } from '@/components/ui/fx/octagon';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = staticPageMetadata({
  title: 'Classement des pronostiqueurs',
  description: 'Le classement général des pronostiqueurs MMA Universe : points cumulés sur tous les événements.',
  path: '/classement',
});

export default async function Page() {
  const leaderboard = await fetchAllTimeLeaderboard();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Pronostiqueurs · général
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Classement</h1>
      </header>
      {leaderboard.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Personne n'a encore pronostiqué d'événement." />
      ) : (
        <ol className="flex flex-col gap-2">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.userId}
              className={`fx-row fx-in-left flex min-h-11 items-center justify-between gap-3 border px-4 py-2 ${
                index === 0 ? 'border-accent bg-accent/10' : 'border-line bg-surface'
              }`}
              style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
            >
              <span className="flex min-w-0 items-center gap-3 text-sm text-ink">
                <OctBadge tone={index === 0 ? 'accent' : 'muted'} size={36}>
                  {index + 1}
                </OctBadge>
                <span className="truncate">{entry.displayName}</span>
              </span>
              <span className="shrink-0 font-display text-lg uppercase text-accent-strong">{entry.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
